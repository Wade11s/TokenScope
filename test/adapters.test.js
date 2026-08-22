import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { claudeAdapter, providerFromClaudeEnvironment } from "../src/adapters/claude.js";
import { codexAdapter } from "../src/adapters/codex.js";
import { continueAdapter } from "../src/adapters/continue.js";
import { copilotAdapter } from "../src/adapters/copilot.js";
import { geminiAdapter } from "../src/adapters/gemini.js";
import { grokAdapter } from "../src/adapters/grok.js";
import { recordsFromHermesRows } from "../src/adapters/hermes.js";
import { kimiAdapter, splitKimiModel } from "../src/adapters/kimi.js";
import { ompAdapter } from "../src/adapters/omp.js";
import { opencodeAdapter } from "../src/adapters/opencode.js";
import { piAdapter } from "../src/adapters/pi.js";
import { compactRecords, dedupeRecords } from "../src/lib/usage.js";

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name) => path.join(fixtureRoot, name);

test("Codex uses cumulative deltas and keeps model changes separate", async () => {
  const records = await codexAdapter.parseFile(fixture("codex.jsonl"));
  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map(({ model, inputTokens, outputTokens, cacheReadTokens }) => ({
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
    })),
    [
      { model: "gpt-alpha", inputTokens: 100, outputTokens: 20, cacheReadTokens: 40 },
      { model: "gpt-beta", inputTokens: 60, outputTokens: 15, cacheReadTokens: 20 },
    ],
  );
});

test("Claude streaming snapshots are deduplicated by message id", async () => {
  const raw = await claudeAdapter.parseFile(fixture("claude.jsonl"), {
    provider: "anthropic",
    inferred: true,
  });
  const records = compactRecords(dedupeRecords(raw));
  assert.equal(records.length, 1);
  assert.equal(records[0].requests, 2);
  assert.equal(records[0].inputTokens, 108);
  assert.equal(records[0].outputTokens, 27);
  assert.equal(records[0].cacheReadTokens, 90);
  assert.equal(records[0].cacheWriteTokens, 5);
  assert.equal(records[0].providerInferred, true);
});

test("Claude provider detection never exposes custom endpoint hostnames", () => {
  assert.deepEqual(providerFromClaudeEnvironment({ ANTHROPIC_BASE_URL: "https://api.kimi.com/coding" }), {
    provider: "moonshot",
    inferred: true,
  });
  assert.deepEqual(providerFromClaudeEnvironment({ ANTHROPIC_BASE_URL: "https://private.example.test" }), {
    provider: "anthropic-compatible",
    inferred: true,
  });
  assert.deepEqual(providerFromClaudeEnvironment({ CLAUDE_CODE_USE_BEDROCK: "true" }), {
    provider: "amazon-bedrock",
    inferred: false,
  });
});

test("Continue reads provider, model, prompt and generated token counts", async () => {
  const [record] = await continueAdapter.parseFile(fixture("continue.jsonl"));
  assert.equal(record.provider, "ollama");
  assert.equal(record.model, "qwen-test");
  assert.equal(record.inputTokens, 44);
  assert.equal(record.outputTokens, 12);
});

test("Copilot marks its missing input count as unknown", async () => {
  const [record] = await copilotAdapter.parseFile(fixture("copilot.jsonl"));
  assert.equal(record.provider, "github-copilot");
  assert.equal(record.outputTokens, 55);
  assert.equal(record.inputKnown, false);
  assert.equal(record.outputKnown, true);
});

test("Gemini and OpenCode normalize their native usage shapes", async () => {
  const [gemini] = await geminiAdapter.parseFile(fixture("gemini.json"));
  assert.equal(gemini.inputTokens, 70);
  assert.equal(gemini.outputTokens, 15);
  assert.equal(gemini.cacheReadTokens, 20);
  assert.equal(gemini.reasoningTokens, 4);

  const [opencode] = await opencodeAdapter.parseFile(fixture("opencode.json"));
  assert.equal(opencode.provider, "provider-test");
  assert.equal(opencode.model, "model-test");
  assert.equal(opencode.inputTokens, 80);
  assert.equal(opencode.outputTokens, 22);
  assert.equal(opencode.cacheWriteTokens, 2);
});

test("Pi adds cache traffic to normalized input without double counting it", async () => {
  const [record, compaction] = await piAdapter.parseFile(fixture("pi.jsonl"));
  assert.equal(record.harness, "pi");
  assert.equal(record.provider, "moonshot");
  assert.equal(record.model, "k3");
  assert.equal(record.inputTokens, 145);
  assert.equal(record.outputTokens, 20);
  assert.equal(record.cacheReadTokens, 40);
  assert.equal(record.cacheWriteTokens, 5);
  assert.equal(record.reasoningTokens, 7);
  assert.equal(record.sessionId, "pi-session");
  assert.equal(compaction.provider, "moonshot");
  assert.equal(compaction.model, "k3");
  assert.equal(compaction.inputTokens, 42);
  assert.equal(compaction.outputTokens, 6);
  assert.equal(compaction.reasoningTokens, 3);
});

test("Hermes normalizes aggregated model usage and namespaces profiles", async () => {
  const rows = JSON.parse(await readFile(fixture("hermes-rows.json"), "utf8"));
  const [record] = recordsFromHermesRows(
    rows,
    "/Users/example/.hermes/profiles/tutor/state.db",
  );
  assert.equal(record.harness, "hermes");
  assert.equal(record.provider, "openai");
  assert.equal(record.model, "gpt-test");
  assert.equal(record.inputTokens, 290);
  assert.equal(record.outputTokens, 30);
  assert.equal(record.cacheReadTokens, 80);
  assert.equal(record.cacheWriteTokens, 10);
  assert.equal(record.reasoningTokens, 9);
  assert.equal(record.requests, 3);
  assert.equal(record.sessionId, "hermes:tutor:hermes-session");
});

test("Kimi Code counts top-level usage records and ignores context mirrors", async () => {
  const records = await kimiAdapter.parseFile(fixture("kimi-wire.jsonl"));
  assert.equal(records.length, 1);
  assert.equal(records[0].provider, "moonshot");
  assert.equal(records[0].model, "k3");
  assert.equal(records[0].inputTokens, 145);
  assert.equal(records[0].outputTokens, 20);
  assert.equal(records[0].cacheReadTokens, 40);
  assert.equal(records[0].cacheWriteTokens, 5);
  assert.deepEqual(splitKimiModel("openrouter/anthropic/model"), {
    provider: "openrouter",
    model: "anthropic/model",
  });
});

test("Grok keeps separate prompts and deduplicates repeated prompt snapshots", async () => {
  const raw = await grokAdapter.parseFile(fixture("grok-updates.jsonl"));
  const records = compactRecords(dedupeRecords(raw));
  assert.equal(records.length, 1);
  assert.equal(records[0].provider, "xai");
  assert.equal(records[0].model, "grok-test-build");
  assert.equal(records[0].inputTokens, 200);
  assert.equal(records[0].outputTokens, 40);
  assert.equal(records[0].cacheReadTokens, 100);
  assert.equal(records[0].reasoningTokens, 12);
  assert.equal(records[0].requests, 3);
});

test("OMP counts assistant and compaction usage but ignores custom mirrors", async () => {
  const records = await ompAdapter.parseFile(fixture("omp.jsonl"));
  assert.equal(records.length, 2);
  assert.equal(records[0].provider, "xai");
  assert.equal(records[0].model, "grok-test");
  assert.equal(records[0].inputTokens, 145);
  assert.equal(records[0].reasoningTokens, 7);
  assert.equal(records[1].inputTokens, 42);
  assert.equal(records[1].outputTokens, 6);
  assert.equal(records[1].reasoningTokens, 3);
});
