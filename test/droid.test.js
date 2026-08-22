import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { droidAdapter } from "../src/adapters/droid.js";
import { dedupeRecords } from "../src/lib/usage.js";

const fixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "droid",
);
const fixture = (name) => path.join(fixtureRoot, name);

test("Droid reads tokenUsage snapshots and does not add inclusive child totals", async () => {
  const [record] = await droidAdapter.parseFile(fixture("session.settings.json"));
  assert.equal(record.harness, "droid");
  assert.equal(record.provider, "factory");
  assert.equal(record.providerInferred, true);
  assert.equal(record.model, "claude-test");
  assert.equal(record.inputTokens, 100);
  assert.equal(record.outputTokens, 20);
  assert.equal(record.cacheReadTokens, 40);
  assert.equal(record.cacheWriteTokens, 5);
  assert.equal(record.reasoningTokens, 7);
  assert.equal(record.requests, 1);
  assert.equal(record.sessionId, "droid:session");
});

test("Droid diffs cumulative snapshots like Codex and skips identical repeats", async () => {
  const records = await droidAdapter.parseFile(fixture("cumulative.settings.json"));
  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map(({ inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens }) => ({
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      reasoningTokens,
    })),
    [
      {
        inputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 40,
        cacheWriteTokens: 5,
        reasoningTokens: 7,
      },
      {
        inputTokens: 60,
        outputTokens: 15,
        cacheReadTokens: 20,
        cacheWriteTokens: 2,
        reasoningTokens: 3,
      },
    ],
  );
});

test("Droid falls back to inclusiveTokenUsage when tokenUsage is absent", async () => {
  const [record] = await droidAdapter.parseFile(fixture("inclusive-only.settings.json"));
  assert.equal(record.provider, "factory");
  assert.equal(record.model, "gpt-test");
  assert.equal(record.inputTokens, 80);
  assert.equal(record.outputTokens, 12);
  assert.equal(record.cacheReadTokens, 20);
  assert.equal(record.cacheWriteTokens, 2);
  assert.equal(record.reasoningTokens, 3);
  assert.equal(record.requests, 1);
});

test("Droid discovers settings.json and ignores session JSONL transcripts", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "droid-adapter-"));
  const sessionDir = path.join(home, ".factory", "sessions", "proj");
  await mkdir(sessionDir, { recursive: true });
  await writeFile(path.join(sessionDir, "sess.settings.json"), "{}\n");
  await writeFile(path.join(sessionDir, "sess.jsonl"), "{\"type\":\"session_start\"}\n");
  const discovery = await droidAdapter.discover(home);
  assert.equal(discovery.detected, true);
  assert.equal(discovery.files.length, 1);
  assert.ok(discovery.files[0].endsWith(`${path.sep}sess.settings.json`));
});

test("Droid deduplicates repeated parses of the same session snapshot", async () => {
  const first = await droidAdapter.parseFile(fixture("session.settings.json"));
  const second = await droidAdapter.parseFile(fixture("session.settings.json"));
  const records = dedupeRecords([...first, ...second]);
  assert.equal(records.length, 1);
  assert.equal(records[0].inputTokens, 100);
  assert.equal(records[0].outputTokens, 20);
  assert.equal(records[0].requests, 1);
});
