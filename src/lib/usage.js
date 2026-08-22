import { canonicalProvider } from "./provider.js";

const ZERO_FIELDS = [
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "reasoningTokens",
];

export function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function hasNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function timestampMs(value) {
  if (typeof value === "number") {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function localDay(value) {
  const date = new Date(timestampMs(value));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function makeRecord(record) {
  const timestamp = timestampMs(record.timestamp);
  return {
    timestamp,
    day: record.day ?? localDay(timestamp),
    harness: record.harness,
    provider: canonicalProvider(record.provider || "unknown"),
    providerInferred: Boolean(record.providerInferred),
    model: record.model || "unknown",
    inputTokens: number(record.inputTokens),
    outputTokens: number(record.outputTokens),
    cacheReadTokens: number(record.cacheReadTokens),
    cacheWriteTokens: number(record.cacheWriteTokens),
    reasoningTokens: number(record.reasoningTokens),
    inputKnown: record.inputKnown !== false,
    outputKnown: record.outputKnown !== false,
    requests: Math.max(1, number(record.requests, 1)),
    sessionId: record.sessionId || "unknown",
    dedupeKey: record.dedupeKey,
  };
}

export function mergeDuplicate(existing, incoming) {
  const merged = { ...existing };
  for (const field of ZERO_FIELDS) {
    merged[field] = Math.max(number(existing[field]), number(incoming[field]));
  }
  merged.timestamp = Math.max(existing.timestamp, incoming.timestamp);
  merged.day = localDay(merged.timestamp);
  merged.inputKnown = existing.inputKnown || incoming.inputKnown;
  merged.outputKnown = existing.outputKnown || incoming.outputKnown;
  merged.providerInferred = existing.providerInferred || incoming.providerInferred;
  merged.requests = Math.max(number(existing.requests), number(incoming.requests), 1);
  if (incoming.model && incoming.model !== "unknown") merged.model = incoming.model;
  if (incoming.provider && incoming.provider !== "unknown") {
    merged.provider = canonicalProvider(incoming.provider);
  }
  return merged;
}

export function dedupeRecords(records) {
  const plain = [];
  const deduped = new Map();

  for (const rawRecord of records) {
    const record = makeRecord(rawRecord);
    if (!record.dedupeKey) {
      plain.push(record);
      continue;
    }

    const previous = deduped.get(record.dedupeKey);
    deduped.set(
      record.dedupeKey,
      previous ? mergeDuplicate(previous, record) : record,
    );
  }

  return plain.concat([...deduped.values()]);
}

export function compactRecords(records) {
  const buckets = new Map();

  for (const rawRecord of records) {
    const record = makeRecord(rawRecord);
    const key = [
      record.day,
      record.harness,
      record.provider,
      record.providerInferred ? "inferred" : "recorded",
      record.model,
      record.sessionId,
    ].join("\u0000");
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        ...record,
        timestamp: record.timestamp,
        requests: 0,
        dedupeKey: undefined,
      };
      for (const field of ZERO_FIELDS) bucket[field] = 0;
      bucket.inputKnown = true;
      bucket.outputKnown = true;
      buckets.set(key, bucket);
    }

    for (const field of ZERO_FIELDS) bucket[field] += number(record[field]);
    bucket.timestamp = Math.max(bucket.timestamp, record.timestamp);
    bucket.requests += record.requests;
    bucket.inputKnown &&= record.inputKnown;
    bucket.outputKnown &&= record.outputKnown;
  }

  return [...buckets.values()];
}

export function usageTotal(record) {
  return number(record.inputTokens) + number(record.outputTokens);
}

export function subtractUsage(current, previous) {
  const currentTotal = number(current?.total_tokens);
  const previousTotal = number(previous?.total_tokens);
  const reset = currentTotal < previousTotal;
  const base = reset ? {} : previous;

  return {
    inputTokens: Math.max(0, number(current?.input_tokens) - number(base?.input_tokens)),
    outputTokens: Math.max(0, number(current?.output_tokens) - number(base?.output_tokens)),
    cacheReadTokens: Math.max(
      0,
      number(current?.cached_input_tokens) - number(base?.cached_input_tokens),
    ),
    cacheWriteTokens: Math.max(
      0,
      number(current?.cache_write_input_tokens) -
        number(base?.cache_write_input_tokens),
    ),
    reasoningTokens: Math.max(
      0,
      number(current?.reasoning_output_tokens) -
        number(base?.reasoning_output_tokens),
    ),
  };
}

export function addUsage(target, record) {
  for (const field of ZERO_FIELDS) target[field] += number(record[field]);
  target.requests += number(record.requests);
  target.inputKnown &&= record.inputKnown !== false;
  target.outputKnown &&= record.outputKnown !== false;
  target.providerInferred ||= Boolean(record.providerInferred);
  return target;
}

export function emptyUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    requests: 0,
    inputKnown: true,
    outputKnown: true,
    providerInferred: false,
  };
}
