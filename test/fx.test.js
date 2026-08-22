import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { adapters } from "../src/adapters/index.js";
import { fxAdapter, splitFxModel } from "../src/adapters/fx.js";
import { dedupeRecords } from "../src/lib/usage.js";

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "fx");
const fixture = (name) => path.join(fixtureRoot, name);

test("fx is registered once and reports partial coverage", () => {
  const matches = adapters.filter((adapter) => adapter.id === "fx");
  assert.equal(matches.length, 1);
  assert.equal(fxAdapter.coverage, "partial");
});

test("fx splits provider/model labels and leaves bare models unknown", () => {
  assert.deepEqual(splitFxModel("gateway/model-alpha"), {
    provider: "gateway",
    model: "model-alpha",
  });
  assert.deepEqual(splitFxModel("model-only"), {
    provider: undefined,
    model: "model-only",
  });
});

test("fx reads provider, model, input, output, cache, and requests from usage-v2 models", async () => {
  const records = await fxAdapter.parseFile(fixture("usage-v2.json"));
  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => ({
      harness: record.harness,
      provider: record.provider,
      model: record.model,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cacheReadTokens: record.cacheReadTokens,
      cacheWriteTokens: record.cacheWriteTokens,
      reasoningTokens: record.reasoningTokens,
      requests: record.requests,
      sessionId: record.sessionId,
    })),
    [
      {
        harness: "fx",
        provider: "gateway",
        model: "model-alpha",
        inputTokens: 100,
        outputTokens: 25,
        cacheReadTokens: 20,
        cacheWriteTokens: 3,
        reasoningTokens: 5,
        requests: 2,
        sessionId: "fx:fx-session-test",
      },
      {
        harness: "fx",
        provider: "gateway",
        model: "model-beta",
        inputTokens: 50,
        outputTokens: 15,
        cacheReadTokens: 10,
        cacheWriteTokens: 2,
        reasoningTokens: 3,
        requests: 1,
        sessionId: "fx:fx-session-test",
      },
    ],
  );
});

test("fx deduplicates repeated usage-v2 snapshots by session and model", async () => {
  const raw = [
    ...(await fxAdapter.parseFile(fixture("usage-v2.json"))),
    ...(await fxAdapter.parseFile(fixture("usage-v2.json"))),
  ];
  const records = dedupeRecords(raw);
  assert.equal(records.length, 2);
  assert.equal(records[0].inputTokens, 100);
  assert.equal(records[1].outputTokens, 15);
  assert.equal(records[0].requests, 2);
});

test("fx rolls up snapshot totals when models is empty", async () => {
  const [record] = await fxAdapter.parseFile(fixture("usage-v2-rollup.json"));
  assert.equal(record.provider, "unknown");
  assert.equal(record.model, "unknown");
  assert.equal(record.inputTokens, 80);
  assert.equal(record.outputTokens, 12);
  assert.equal(record.cacheReadTokens, 10);
  assert.equal(record.cacheWriteTokens, 1);
  assert.equal(record.reasoningTokens, 2);
  assert.equal(record.requests, 1);
  assert.equal(record.sessionId, "fx:fx-session-rollup");
});

test("fx does not invent tokens from usage.jsonl coverage lines", async () => {
  const records = await fxAdapter.parseFile(fixture("usage.jsonl"));
  assert.deepEqual(records, []);
});

test("fx discovers usage-v2 sidecars under ~/.fx/sessions", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "tokenscope-fx-"));
  const sessionDir = path.join(homeDir, ".fx", "sessions", "fx-session-test");
  await mkdir(sessionDir, { recursive: true });
  await writeFile(path.join(sessionDir, "usage-v2.json"), "{}\n");
  await writeFile(path.join(homeDir, ".fx", "usage.jsonl"), "{}\n");

  const found = await fxAdapter.discover(homeDir);
  assert.equal(found.detected, true);
  assert.equal(found.displayPath, "~/.fx/sessions/**/usage-v2.json");
  assert.deepEqual(found.files, [path.join(sessionDir, "usage-v2.json")]);
});
