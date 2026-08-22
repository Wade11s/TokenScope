import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDER_ALIASES, canonicalProvider } from "../src/lib/provider.js";
import {
  compactRecords,
  dedupeRecords,
  makeRecord,
  mergeDuplicate,
} from "../src/lib/usage.js";

const ALIAS_FAMILIES = {
  openai: [
    "openai",
    "open-ai",
    "openai-codex",
    "codex-oauth",
    "openai-oauth",
    "openai-codex-oauth",
  ],
  xai: ["xai", "xai-oauth", "xai-auth"],
  moonshot: [
    "moonshot",
    "moonshot-ai",
    "moonshotai",
    "kimi",
    "kimi-code",
    "kimi-coding",
    "kimi-for-coding",
  ],
  anthropic: ["anthropic", "anthropic-oauth", "anthropic-auth"],
  "google-gemini": ["gemini", "google-gemini", "gemini-oauth", "gemini-auth"],
};

const CANONICAL_NAMES = Object.keys(ALIAS_FAMILIES);

test("canonical provider folds each alias family to its canonical name", () => {
  for (const [canonical, aliases] of Object.entries(ALIAS_FAMILIES)) {
    for (const alias of aliases) {
      assert.equal(canonicalProvider(alias), canonical, alias);
    }
  }
  // Auth-suffix spellings explicitly named in the table.
  assert.equal(canonicalProvider("google-gemini-oauth"), "google-gemini");
  assert.equal(canonicalProvider("google-gemini-auth"), "google-gemini");
});

test("safe separator and case variants canonicalize within each family", () => {
  const variants = new Map([
    ["OpenAI", "openai"],
    ["OpenAI-Codex", "openai"],
    ["codex_oauth", "openai"],
    [" openai ", "openai"],
    ["open ai", "openai"],
    ["OPENAI CODEX OAUTH", "openai"],
    ["XAI", "xai"],
    ["XAI_OAuth", "xai"],
    [" xai-auth ", "xai"],
    ["Moonshot", "moonshot"],
    ["MoonshotAI", "moonshot"],
    ["Kimi", "moonshot"],
    ["Kimi for Coding", "moonshot"],
    ["KIMI_FOR_CODING", "moonshot"],
    ["kimi coding", "moonshot"],
    ["Anthropic", "anthropic"],
    ["ANTHROPIC oauth", "anthropic"],
    ["Gemini", "google-gemini"],
    ["GOOGLE GEMINI", "google-gemini"],
    ["google_gemini", "google-gemini"],
  ]);
  for (const [variant, canonical] of variants) {
    assert.equal(canonicalProvider(variant), canonical, variant);
  }
});

test("unknown providers and lookalikes pass through unchanged", () => {
  for (const preserved of [
    "amazon-bedrock",
    "google-vertex",
    "azure-foundry",
    "openrouter",
    "github-copilot",
    "anthropic-compatible",
    "local-proxy",
    "zai",
    "zai-coding-cn",
    "xiaomi-token-plan-cn",
    "deepseek",
    "ollama",
    "auto",
    "moa",
    "openai-compatible",
    "codex",
    "grok",
    "kimi-coding-pro",
    "openai-codex-legacy",
    "codex-oauth-beta",
    "unknown",
  ]) {
    assert.equal(canonicalProvider(preserved), preserved, preserved);
  }
});

test("distinct billing and routing providers never merge", () => {
  // Same underlying models, different billers/routers: must stay distinct.
  const distinctGroups = [
    ["anthropic", "amazon-bedrock", "google-vertex", "azure-foundry", "anthropic-compatible"],
    ["openai", "openrouter"],
    ["openai", "github-copilot"],
    ["moonshot", "local-proxy"],
    ["xai", "openrouter"],
    ["google-gemini", "google-vertex"],
  ];
  for (const group of distinctGroups) {
    const canonical = new Set(group.map((provider) => canonicalProvider(provider)));
    assert.equal(canonical.size, group.length, group.join(" vs "));
  }
});

test("non-string and empty values pass through untouched", () => {
  assert.equal(canonicalProvider(undefined), undefined);
  assert.equal(canonicalProvider(null), null);
  assert.equal(canonicalProvider(""), "");
  assert.equal(canonicalProvider(42), 42);
});

test("alias table is an explicit allowlist, not pattern derived", () => {
  const expected = new Set(
    Object.values(ALIAS_FAMILIES).flat().concat([
      "google-gemini-oauth",
      "google-gemini-auth",
    ]),
  );
  assert.deepEqual(
    [...PROVIDER_ALIASES.keys()].sort(),
    [...expected].sort(),
  );
  for (const canonical of PROVIDER_ALIASES.values()) {
    assert.ok(CANONICAL_NAMES.includes(canonical), canonical);
  }
});

test("makeRecord canonicalizes provider at the normalization seam", () => {
  for (const [canonical, aliases] of Object.entries(ALIAS_FAMILIES)) {
    for (const alias of aliases) {
      const record = makeRecord({
        timestamp: "2026-08-20T12:00:00+08:00",
        harness: "codex",
        provider: alias,
        model: "test-model",
        inputTokens: 10,
        sessionId: "s",
      });
      assert.equal(record.provider, canonical, alias);
    }
  }
});

test("makeRecord keeps providerInferred semantics for aliases", () => {
  const inferred = makeRecord({
    timestamp: "2026-08-20T12:00:00+08:00",
    provider: "Kimi-For-Coding",
    providerInferred: true,
    harness: "pi",
    model: "k3",
    sessionId: "s",
  });
  assert.equal(inferred.provider, "moonshot");
  assert.equal(inferred.providerInferred, true);

  const recorded = makeRecord({
    timestamp: "2026-08-20T12:00:00+08:00",
    provider: "xai-oauth",
    harness: "omp",
    model: "grok-test",
    sessionId: "s",
  });
  assert.equal(recorded.provider, "xai");
  assert.equal(recorded.providerInferred, false);
});

test("makeRecord preserves unknown provider fallback and passes it through", () => {
  const missing = makeRecord({
    timestamp: "2026-08-20T12:00:00+08:00",
    harness: "codex",
    model: "gpt-test",
    sessionId: "s",
  });
  assert.equal(missing.provider, "unknown");

  const explicit = makeRecord({
    timestamp: "2026-08-20T12:00:00+08:00",
    harness: "omp",
    provider: "moonshot-via-omp",
    model: "k3",
    sessionId: "s",
  });
  assert.equal(explicit.provider, "moonshot-via-omp");
});

test("mergeDuplicate canonicalizes an incoming alias over a merged record", () => {
  const existing = makeRecord({
    timestamp: "2026-08-20T10:00:00+08:00",
    harness: "omp",
    provider: "xai",
    model: "grok-test",
    inputTokens: 100,
    sessionId: "s",
    dedupeKey: "k",
  });
  const incoming = makeRecord({
    timestamp: "2026-08-20T11:00:00+08:00",
    harness: "omp",
    provider: "xai-oauth",
    model: "grok-test",
    inputTokens: 50,
    sessionId: "s",
    dedupeKey: "k",
  });
  const merged = mergeDuplicate(existing, incoming);
  assert.equal(merged.provider, "xai");
  assert.equal(merged.inputTokens, 100);
});

test("dedupe collapses same-key records even when raw providers differ", () => {
  const deduped = dedupeRecords([
    {
      timestamp: "2026-08-20T10:00:00+08:00",
      harness: "omp",
      provider: "openai-codex",
      model: "gpt-test",
      inputTokens: 100,
      sessionId: "s",
      dedupeKey: "same",
    },
    {
      timestamp: "2026-08-20T11:00:00+08:00",
      harness: "omp",
      provider: "codex_oauth",
      model: "gpt-test",
      inputTokens: 100,
      sessionId: "s",
      dedupeKey: "same",
    },
  ]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].provider, "openai");
  assert.equal(deduped[0].requests, 1);
});

test("compaction buckets aliases of one provider together", () => {
  // The three records below share a session but were normalized under
  // different alias spellings; they must land in one compaction bucket,
  // while a distinct provider with the same shape stays separate.
  const compacted = compactRecords([
    {
      timestamp: "2026-08-20T10:00:00+08:00",
      harness: "pi",
      provider: "kimi-coding",
      model: "k3",
      inputTokens: 100,
      outputTokens: 10,
      requests: 2,
      sessionId: "s1",
    },
    {
      timestamp: "2026-08-20T11:00:00+08:00",
      harness: "pi",
      provider: "kimi-for-coding",
      model: "k3",
      inputTokens: 50,
      outputTokens: 5,
      requests: 3,
      sessionId: "s1",
    },
    {
      timestamp: "2026-08-20T12:00:00+08:00",
      harness: "pi",
      provider: "moonshot",
      model: "k3",
      inputTokens: 1,
      outputTokens: 1,
      requests: 1,
      sessionId: "s1",
    },
    {
      timestamp: "2026-08-20T12:00:00+08:00",
      harness: "pi",
      provider: "xai",
      model: "k3",
      inputTokens: 7,
      outputTokens: 7,
      requests: 1,
      sessionId: "s1",
    },
  ]);
  assert.equal(compacted.length, 2);
  const moonshot = compacted.find((record) => record.provider === "moonshot");
  assert.ok(moonshot);
  assert.equal(moonshot.inputTokens, 151);
  assert.equal(moonshot.outputTokens, 16);
  assert.equal(moonshot.requests, 6);
});

test("cached records with raw aliases re-canonicalize on replay", () => {
  // The indexer replays per-file cached records through makeRecord on every
  // scan, so a cache written before canonicalization self-heals without a
  // version bump. Simulate stale cached records here, one per family.
  const stale = [
    { provider: "openai-codex" },
    { provider: "xai-oauth" },
    { provider: "kimi-coding" },
    { provider: "anthropic-oauth" },
    { provider: "gemini" },
  ].map((overrides) => ({
    timestamp: Date.parse("2026-08-20T10:00:00+08:00"),
    day: "2026-08-20",
    harness: "cached",
    providerInferred: false,
    model: "test-model",
    inputTokens: 10,
    outputTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    inputKnown: true,
    outputKnown: true,
    requests: 1,
    sessionId: "s1",
    dedupeKey: undefined,
    ...overrides,
  }));
  const replayed = compactRecords(dedupeRecords(stale));
  assert.equal(replayed.length, stale.length);
  assert.deepEqual(
    replayed.map((record) => record.provider).sort(),
    ["anthropic", "google-gemini", "moonshot", "openai", "xai"],
  );
});

test("canonicalization never changes providerInferred aggregation", () => {
  const compacted = compactRecords([
    {
      timestamp: "2026-08-20T10:00:00+08:00",
      harness: "pi",
      provider: "kimi-coding",
      providerInferred: true,
      model: "k3",
      inputTokens: 10,
      sessionId: "s1",
    },
    {
      timestamp: "2026-08-20T11:00:00+08:00",
      harness: "pi",
      provider: "moonshot",
      providerInferred: false,
      model: "k3",
      inputTokens: 20,
      sessionId: "s1",
    },
  ]);
  // Compaction still keeps inferred and recorded providers in separate
  // buckets, exactly as before canonicalization.
  assert.equal(compacted.length, 2);
  assert.equal(compacted[0].provider, "moonshot");
  assert.equal(compacted[1].provider, "moonshot");
  assert.deepEqual(
    compacted.map((record) => record.providerInferred).sort(),
    [false, true],
  );
});
