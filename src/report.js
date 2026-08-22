import { addUsage, emptyUsage, usageTotal } from "./lib/usage.js";

const RANGE_DAYS = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const ACTIVITY_WEEKS = 53;

function dayFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const aligned = new Date(date);
  aligned.setHours(12, 0, 0, 0);
  aligned.setDate(aligned.getDate() - ((aligned.getDay() + 6) % 7));
  return aligned;
}

function rangeInfo(key, records, now) {
  const normalized = key in RANGE_DAYS || key === "all" ? key : "30d";
  const to = dayFromDate(now);
  if (normalized === "all") {
    const from = records.reduce(
      (earliest, record) => (!earliest || record.day < earliest ? record.day : earliest),
      null,
    );
    return { key: normalized, from, to };
  }
  const fromDate = new Date(now);
  fromDate.setHours(12, 0, 0, 0);
  fromDate.setDate(fromDate.getDate() - RANGE_DAYS[normalized] + 1);
  return { key: normalized, from: dayFromDate(fromDate), to };
}

function inRange(record, range) {
  if (range.from && record.day < range.from) return false;
  return record.day <= range.to;
}

function groupRecords(records, keyForRecord, fieldsForRecord) {
  const groups = new Map();
  for (const record of records) {
    const key = keyForRecord(record);
    let group = groups.get(key);
    if (!group) {
      group = { ...fieldsForRecord(record), ...emptyUsage(), sessions: new Set() };
      groups.set(key, group);
    }
    addUsage(group, record);
    group.sessions.add(record.sessionId);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    sessions: group.sessions.size,
    knownTokens: group.inputTokens + group.outputTokens,
    complete: group.inputKnown && group.outputKnown,
  }));
}

function sortUsage(groups) {
  return groups.sort((a, b) => b.knownTokens - a.knownTokens);
}

function buildActivity(records, harnesses, now) {
  const currentWeekStart = startOfWeek(now);
  const fromDate = new Date(currentWeekStart);
  fromDate.setDate(fromDate.getDate() - (ACTIVITY_WEEKS - 1) * 7);
  const from = dayFromDate(fromDate);
  const to = dayFromDate(now);

  const byDay = new Map();
  for (const record of records) {
    if (!harnesses.has(record.harness)) continue;
    if (record.day < from || record.day > to) continue;
    let usage = byDay.get(record.day);
    if (!usage) {
      usage = emptyUsage();
      byDay.set(record.day, usage);
    }
    addUsage(usage, record);
  }

  const days = [];
  let max = 0;
  let activeDays = 0;
  let totalTokens = 0;
  let totalKnown = true;
  let run = 0;
  let longestStreak = 0;
  const cursor = new Date(fromDate);
  for (let index = 0; index < ACTIVITY_WEEKS * 7; index += 1) {
    const day = dayFromDate(cursor);
    const usage = byDay.get(day);
    const knownTokens = usage ? usage.inputTokens + usage.outputTokens : 0;
    const future = day > to;
    if (!future && knownTokens > 0) {
      activeDays += 1;
      totalTokens += knownTokens;
      totalKnown &&= usage.inputKnown && usage.outputKnown;
      max = Math.max(max, knownTokens);
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else if (!future) {
      run = 0;
    }
    days.push({
      day,
      future,
      inputTokens: usage?.inputTokens || 0,
      outputTokens: usage?.outputTokens || 0,
      knownTokens,
      requests: usage?.requests || 0,
      complete: usage ? usage.inputKnown && usage.outputKnown : true,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  let currentStreak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index].future) continue;
    if (days[index].knownTokens > 0) currentStreak += 1;
    else break;
  }

  return {
    from,
    to,
    weeks: ACTIVITY_WEEKS,
    days,
    max,
    activeDays,
    totalTokens,
    totalKnown,
    longestStreak,
    currentStreak,
  };
}

export function buildReport(
  snapshot,
  { range: requestedRange = "30d", harnesses = [], now = new Date() } = {},
) {
  const range = rangeInfo(requestedRange, snapshot.records, now);
  const rangeRecords = snapshot.records.filter((record) => inRange(record, range));
  const availableHarnesses = new Set(
    snapshot.sources
      .filter((source) => source.detected || source.knownTokens > 0)
      .map((source) => source.id),
  );
  const selectedHarnesses = new Set(
    harnesses.length > 0
      ? harnesses.filter((id) => availableHarnesses.has(id))
      : [...availableHarnesses],
  );
  const records = rangeRecords.filter((record) => selectedHarnesses.has(record.harness));

  const detailedGroups = sortUsage(
    groupRecords(
      records,
      (record) => `${record.harness}\u0000${record.provider}\u0000${record.model}`,
      (record) => ({
        harness: record.harness,
        provider: record.provider,
        model: record.model,
      }),
    ),
  );
  const daily = groupRecords(
    records,
    (record) => record.day,
    (record) => ({ day: record.day }),
  ).sort((a, b) => a.day.localeCompare(b.day));
  const providers = sortUsage(
    groupRecords(
      records,
      (record) => record.provider,
      (record) => ({ name: record.provider }),
    ),
  );
  const models = sortUsage(
    groupRecords(
      records,
      (record) => `${record.provider}\u0000${record.model}`,
      (record) => ({ name: record.model, provider: record.provider }),
    ),
  );
  const harnessGroups = sortUsage(
    groupRecords(
      records,
      (record) => record.harness,
      (record) => ({ name: record.harness }),
    ),
  );

  const summary = { ...emptyUsage(), sessions: new Set() };
  for (const record of records) {
    addUsage(summary, record);
    summary.sessions.add(record.sessionId);
  }
  const selectedSourceDefinitions = snapshot.sources.filter((source) =>
    selectedHarnesses.has(source.id),
  );
  const inputCoverageComplete = selectedSourceDefinitions.every(
    (source) => source.coverage === "full",
  );
  const outputCoverageComplete = selectedSourceDefinitions.every(
    (source) => source.coverage !== "unavailable",
  );
  const inputKnown = summary.inputKnown && inputCoverageComplete;
  const outputKnown = summary.outputKnown && outputCoverageComplete;
  const knownTokens = summary.inputTokens + summary.outputTokens;
  const cacheRate = summary.inputTokens
    ? summary.cacheReadTokens / summary.inputTokens
    : 0;

  const rangeByHarness = new Map(
    groupRecords(
      rangeRecords,
      (record) => record.harness,
      (record) => ({ name: record.harness }),
    ).map((group) => [group.name, group]),
  );
  const sources = snapshot.sources.map((source) => {
    const totals = rangeByHarness.get(source.id);
    return {
      ...source,
      selected: selectedHarnesses.has(source.id),
      rangeKnownTokens: totals?.knownTokens || 0,
      rangeRequests: totals?.requests || 0,
      rangeComplete: totals?.complete ?? source.coverage === "full",
    };
  });

  return {
    generatedAt: snapshot.generatedAt,
    timezone: snapshot.timezone,
    range,
    summary: {
      ...summary,
      sessions: summary.sessions.size,
      knownTokens,
      inputKnown,
      outputKnown,
      complete: inputKnown && outputKnown,
      cacheRate,
      topModel: detailedGroups[0]?.model || null,
    },
    daily,
    groups: detailedGroups,
    breakdowns: {
      providers,
      models,
      harnesses: harnessGroups,
    },
    activity: buildActivity(snapshot.records, selectedHarnesses, now),
    sources,
    cache: snapshot.cache,
  };
}

export function totalKnownTokens(records) {
  return records.reduce((sum, record) => sum + usageTotal(record), 0);
}
