import assert from "node:assert/strict";
import test from "node:test";
import { makeRecord } from "../src/lib/usage.js";
import { buildReport } from "../src/report.js";

function snapshot(records) {
  return {
    generatedAt: "2026-08-20T04:00:00.000Z",
    timezone: "Asia/Shanghai",
    records,
    sources: [
      { id: "codex", name: "Codex", detected: true, coverage: "full" },
      { id: "copilot", name: "Copilot", detected: true, coverage: "partial" },
    ],
    cache: { indexedFiles: 2, parsedFiles: 2, reusedFiles: 0, durationMs: 10 },
  };
}

test("report applies an inclusive local-day range and exposes partial totals", () => {
  const report = buildReport(
    snapshot([
      makeRecord({
        timestamp: "2026-08-14T12:00:00+08:00",
        harness: "codex",
        provider: "openai",
        model: "gpt-test",
        inputTokens: 100,
        outputTokens: 10,
        sessionId: "one",
      }),
      makeRecord({
        timestamp: "2026-08-20T12:00:00+08:00",
        harness: "copilot",
        provider: "github-copilot",
        model: "claude-test",
        inputTokens: 0,
        outputTokens: 20,
        inputKnown: false,
        sessionId: "two",
      }),
      makeRecord({
        timestamp: "2026-08-13T12:00:00+08:00",
        harness: "codex",
        provider: "openai",
        model: "old",
        inputTokens: 999,
        outputTokens: 1,
        sessionId: "old",
      }),
    ]),
    { range: "7d", now: new Date("2026-08-20T12:00:00+08:00") },
  );

  assert.equal(report.range.from, "2026-08-14");
  assert.equal(report.summary.knownTokens, 130);
  assert.equal(report.summary.complete, false);
  assert.equal(report.summary.sessions, 2);
  assert.equal(report.groups.length, 2);
});

test("report filters harnesses without changing source range totals", () => {
  const report = buildReport(
    snapshot([
      makeRecord({
        timestamp: "2026-08-20T12:00:00+08:00",
        harness: "codex",
        provider: "openai",
        model: "gpt-test",
        inputTokens: 100,
        outputTokens: 10,
        sessionId: "one",
      }),
      makeRecord({
        timestamp: "2026-08-20T12:00:00+08:00",
        harness: "copilot",
        provider: "github-copilot",
        model: "claude-test",
        outputTokens: 20,
        inputKnown: false,
        sessionId: "two",
      }),
    ]),
    {
      range: "today",
      harnesses: ["codex"],
      now: new Date("2026-08-20T12:00:00+08:00"),
    },
  );

  assert.equal(report.summary.knownTokens, 110);
  assert.equal(report.summary.complete, true);
  assert.deepEqual(
    report.breakdowns.harnesses.map((harness) => harness.name),
    ["codex"],
  );
  assert.deepEqual(report.daily.map((day) => day.day), ["2026-08-20"]);
  assert.ok(report.groups.every((group) => group.harness === "codex"));
  assert.equal(report.sources.find((source) => source.id === "copilot").rangeKnownTokens, 20);
  assert.equal(report.sources.find((source) => source.id === "copilot").selected, false);
});

test("a selected unavailable source makes an otherwise exact total a lower bound", () => {
  const base = snapshot([
    makeRecord({
      timestamp: "2026-08-20T12:00:00+08:00",
      harness: "codex",
      provider: "openai",
      model: "gpt-test",
      inputTokens: 100,
      outputTokens: 10,
      sessionId: "one",
    }),
  ]);
  base.sources.push({
    id: "cursor",
    name: "Cursor",
    detected: true,
    coverage: "unavailable",
  });

  const allSources = buildReport(base, {
    range: "today",
    now: new Date("2026-08-20T12:00:00+08:00"),
  });
  assert.equal(allSources.summary.knownTokens, 110);
  assert.equal(allSources.summary.complete, false);
  assert.equal(allSources.summary.inputKnown, false);
  assert.equal(allSources.summary.outputKnown, false);

  const codexOnly = buildReport(base, {
    range: "today",
    harnesses: ["codex"],
    now: new Date("2026-08-20T12:00:00+08:00"),
  });
  assert.equal(codexOnly.summary.complete, true);
});

test("activity covers 53 aligned weeks and follows the harness filter", () => {
  const report = buildReport(
    snapshot([
      makeRecord({
        timestamp: "2026-08-19T12:00:00+08:00",
        harness: "codex",
        provider: "openai",
        model: "gpt-test",
        inputTokens: 100,
        outputTokens: 20,
        sessionId: "one",
      }),
      makeRecord({
        timestamp: "2026-08-20T12:00:00+08:00",
        harness: "codex",
        provider: "openai",
        model: "gpt-test",
        inputTokens: 50,
        outputTokens: 5,
        sessionId: "one",
      }),
      makeRecord({
        timestamp: "2026-08-19T12:00:00+08:00",
        harness: "copilot",
        provider: "github-copilot",
        model: "claude-test",
        outputTokens: 999,
        inputKnown: false,
        sessionId: "two",
      }),
      makeRecord({
        timestamp: "2025-08-17T12:00:00+08:00",
        harness: "codex",
        provider: "openai",
        model: "pre-window",
        inputTokens: 10_000,
        outputTokens: 1,
        sessionId: "old",
      }),
    ]),
    { range: "7d", now: new Date("2026-08-20T12:00:00+08:00") },
  );

  const activity = report.activity;
  // 2026-08-20 is a Thursday; the window starts on the Monday 52 weeks earlier.
  assert.equal(activity.from, "2025-08-18");
  assert.equal(activity.to, "2026-08-20");
  assert.equal(activity.days.length, 53 * 7);
  assert.equal(activity.days[0].day, "2025-08-18");
  assert.equal(activity.days.at(-1).day, "2026-08-23");
  assert.deepEqual(
    activity.days.slice(-3).map((day) => day.future),
    [true, true, true],
  );
  assert.equal(activity.days[0].knownTokens, 0);

  // Default selection includes every detected source, so both records merge into 8/19.
  const codexDay = activity.days.find((day) => day.day === "2026-08-19");
  assert.equal(codexDay.knownTokens, 1119);
  assert.equal(codexDay.requests, 2);
  assert.equal(codexDay.complete, false);
  assert.equal(activity.activeDays, 2);
  assert.equal(activity.longestStreak, 2);
  assert.equal(activity.currentStreak, 2);
  assert.equal(activity.max, 1119);
  assert.equal(activity.totalTokens, 1174);
});

test("activity honors an explicit harness filter", () => {
  const report = buildReport(
    snapshot([
      makeRecord({
        timestamp: "2026-08-19T12:00:00+08:00",
        harness: "codex",
        provider: "openai",
        model: "gpt-test",
        inputTokens: 100,
        outputTokens: 20,
        sessionId: "one",
      }),
      makeRecord({
        timestamp: "2026-08-19T12:00:00+08:00",
        harness: "copilot",
        provider: "github-copilot",
        model: "claude-test",
        outputTokens: 999,
        sessionId: "two",
      }),
    ]),
    {
      range: "today",
      harnesses: ["codex"],
      now: new Date("2026-08-20T12:00:00+08:00"),
    },
  );

  const day = report.activity.days.find((entry) => entry.day === "2026-08-19");
  assert.equal(day.knownTokens, 120);
  assert.equal(report.activity.totalKnown, true);
  assert.equal(report.activity.currentStreak, 0);
});

test("scoping to a harness with unknown token counts keeps its lower-bound flags", () => {
  const report = buildReport(
    snapshot([
      makeRecord({
        timestamp: "2026-08-20T12:00:00+08:00",
        harness: "copilot",
        provider: "github-copilot",
        model: "claude-test",
        inputTokens: 0,
        outputTokens: 20,
        inputKnown: false,
        sessionId: "two",
      }),
      makeRecord({
        timestamp: "2026-08-20T12:00:00+08:00",
        harness: "codex",
        provider: "openai",
        model: "gpt-test",
        outputTokens: 999,
        inputKnown: false,
        sessionId: "three",
      }),
    ]),
    {
      range: "today",
      harnesses: ["copilot"],
      now: new Date("2026-08-20T12:00:00+08:00"),
    },
  );

  assert.equal(report.summary.knownTokens, 20);
  assert.equal(report.summary.inputKnown, false);
  assert.equal(report.summary.outputKnown, true);
  assert.equal(report.summary.complete, false);
});

test("an unknown harness id yields a well-formed empty report", () => {
  const report = buildReport(
    snapshot([
      makeRecord({
        timestamp: "2026-08-20T12:00:00+08:00",
        harness: "codex",
        provider: "openai",
        model: "gpt-test",
        inputTokens: 100,
        outputTokens: 10,
        sessionId: "one",
      }),
    ]),
    {
      range: "today",
      harnesses: ["no-such-harness"],
      now: new Date("2026-08-20T12:00:00+08:00"),
    },
  );

  assert.equal(report.summary.knownTokens, 0);
  assert.equal(report.summary.requests, 0);
  assert.equal(report.summary.sessions, 0);
  assert.equal(report.summary.topModel, null);
  assert.deepEqual(report.daily, []);
  assert.deepEqual(report.groups, []);
  assert.deepEqual(report.breakdowns.providers, []);
  assert.deepEqual(report.breakdowns.models, []);
  assert.deepEqual(report.breakdowns.harnesses, []);
  // No source is selected, so the empty total stays an exact zero.
  assert.equal(report.summary.complete, true);
  assert.ok(report.sources.every((source) => !source.selected));
  assert.equal(report.activity.totalTokens, 0);
});

test("provider aliases aggregate into one provider while model detail stays distinct", () => {
  const base = snapshot([
    makeRecord({
      timestamp: "2026-08-20T10:00:00+08:00",
      harness: "codex",
      provider: "openai",
      model: "gpt-5",
      inputTokens: 100,
      outputTokens: 10,
      sessionId: "one",
    }),
    makeRecord({
      timestamp: "2026-08-20T11:00:00+08:00",
      harness: "codex",
      provider: "openai-codex",
      model: "gpt-5-codex",
      inputTokens: 200,
      outputTokens: 20,
      sessionId: "two",
    }),
    makeRecord({
      timestamp: "2026-08-20T12:00:00+08:00",
      harness: "hermes",
      provider: "codex_oauth",
      model: "gpt-5-codex",
      inputTokens: 400,
      outputTokens: 40,
      sessionId: "three",
    }),
    makeRecord({
      timestamp: "2026-08-20T13:00:00+08:00",
      harness: "codex",
      provider: "anthropic",
      model: "claude-test",
      inputTokens: 50,
      outputTokens: 5,
      sessionId: "four",
    }),
  ]);
  base.sources.push({
    id: "hermes",
    name: "Hermes Agent",
    detected: true,
    coverage: "full",
  });

  const report = buildReport(base, {
    range: "today",
    now: new Date("2026-08-20T14:00:00+08:00"),
  });

  // One canonical openai provider row absorbs all alias records; the
  // anthropic row stays separate; no openai-codex/codex-oauth rows leak.
  assert.deepEqual(
    report.breakdowns.providers.map((provider) => provider.name),
    ["openai", "anthropic"],
  );
  const openai = report.breakdowns.providers[0];
  assert.equal(openai.inputTokens, 700);
  assert.equal(openai.outputTokens, 70);
  assert.equal(openai.requests, 3);
  assert.equal(openai.sessions, 3);

  // Detailed harness/model groups keep per-model resolution.
  const openaiModels = report.breakdowns.models
    .filter((model) => model.provider === "openai")
    .map((model) => model.name)
    .sort();
  assert.deepEqual(openaiModels, ["gpt-5", "gpt-5-codex"]);
});

test("extended alias families collapse per provider and distinct billers stay separate", () => {
  const base = snapshot([
    makeRecord({ timestamp: "2026-08-20T10:00:00+08:00", harness: "omp", provider: "xai-oauth", model: "grok-test", inputTokens: 100, outputTokens: 10, sessionId: "a1" }),
    makeRecord({ timestamp: "2026-08-20T10:30:00+08:00", harness: "omp", provider: "xai-auth", model: "grok-test", inputTokens: 50, outputTokens: 5, sessionId: "a2" }),
    makeRecord({ timestamp: "2026-08-20T11:00:00+08:00", harness: "grok", provider: "xai", model: "grok-4", inputTokens: 25, outputTokens: 2, sessionId: "a3" }),
    makeRecord({ timestamp: "2026-08-20T10:00:00+08:00", harness: "pi", provider: "kimi-coding", model: "k3", inputTokens: 100, outputTokens: 10, sessionId: "b1" }),
    makeRecord({ timestamp: "2026-08-20T11:00:00+08:00", harness: "kimi", provider: "kimi-for-coding", model: "k3", inputTokens: 60, outputTokens: 6, sessionId: "b2" }),
    makeRecord({ timestamp: "2026-08-20T12:00:00+08:00", harness: "claude", provider: "moonshot", model: "k3", inputTokens: 30, outputTokens: 3, sessionId: "b3" }),
    makeRecord({ timestamp: "2026-08-20T10:00:00+08:00", harness: "claude", provider: "anthropic-oauth", model: "claude-test", inputTokens: 10, outputTokens: 1, sessionId: "c1" }),
    makeRecord({ timestamp: "2026-08-20T11:00:00+08:00", harness: "claude", provider: "Anthropic", model: "claude-test", inputTokens: 20, outputTokens: 2, sessionId: "c2" }),
    makeRecord({ timestamp: "2026-08-20T12:00:00+08:00", harness: "gemini", provider: "gemini", model: "gemini-test", inputTokens: 5, outputTokens: 1, sessionId: "d1" }),
    makeRecord({ timestamp: "2026-08-20T13:00:00+08:00", harness: "gemini", provider: "google-gemini-auth", model: "gemini-test", inputTokens: 6, outputTokens: 1, sessionId: "d2" }),
    makeRecord({ timestamp: "2026-08-20T14:00:00+08:00", harness: "claude", provider: "amazon-bedrock", model: "claude-test", inputTokens: 99, outputTokens: 9, sessionId: "e1" }),
    makeRecord({ timestamp: "2026-08-20T14:30:00+08:00", harness: "claude", provider: "google-vertex", model: "claude-test", inputTokens: 98, outputTokens: 9, sessionId: "e2" }),
  ]);
  base.sources.push(
    { id: "omp", name: "OMP", detected: true, coverage: "full" },
    { id: "grok", name: "Grok CLI", detected: true, coverage: "full" },
    { id: "pi", name: "Pi", detected: true, coverage: "full" },
    { id: "kimi", name: "Kimi Code", detected: true, coverage: "full" },
    { id: "claude", name: "Claude Code", detected: true, coverage: "full" },
    { id: "gemini", name: "Gemini CLI", detected: true, coverage: "full" },
  );

  const report = buildReport(base, {
    range: "today",
    now: new Date("2026-08-20T15:00:00+08:00"),
  });

  const providerNames = report.breakdowns.providers.map((provider) => provider.name);
  // Each alias family collapses to one canonical row; the two distinct
  // cloud-routing providers remain their own rows.
  assert.deepEqual([...providerNames].sort(), [
    "amazon-bedrock",
    "anthropic",
    "google-gemini",
    "google-vertex",
    "moonshot",
    "xai",
  ]);
  assert.ok(!providerNames.includes("xai-oauth"));
  assert.ok(!providerNames.includes("xai-auth"));
  assert.ok(!providerNames.includes("kimi-coding"));
  assert.ok(!providerNames.includes("kimi-for-coding"));
  assert.ok(!providerNames.includes("anthropic-oauth"));
  assert.ok(!providerNames.includes("gemini"));

  const xai = report.breakdowns.providers.find((p) => p.name === "xai");
  assert.equal(xai.inputTokens, 175);
  assert.equal(xai.requests, 3);
  const moonshot = report.breakdowns.providers.find((p) => p.name === "moonshot");
  assert.equal(moonshot.inputTokens, 190);
  assert.equal(moonshot.requests, 3);
  const geminiFamily = report.breakdowns.providers.find((p) => p.name === "google-gemini");
  assert.equal(geminiFamily.inputTokens, 11);
  const anthropicRow = report.breakdowns.providers.find((p) => p.name === "anthropic");
  assert.ok(anthropicRow);
  assert.equal(anthropicRow.inputTokens, 30);

  // Model detail remains distinct inside a family.
  const geminiModels = report.breakdowns.models
    .filter((model) => model.provider === "google-gemini")
    .map((model) => model.name);
  assert.deepEqual(geminiModels, ["gemini-test"]);
  const moonshotModels = report.breakdowns.models
    .filter((model) => model.provider === "moonshot")
    .map((model) => model.name);
  assert.deepEqual(moonshotModels, ["k3"]);
});
