import assert from "node:assert/strict";
import test from "node:test";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HARNESS_LOGO_IDS,
  harnessLogoSrc,
  harnessMarkFallback,
  sortSourcesByRangeUsage,
} from "../public/harness-marks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("总览 Harness cards sort by range token usage, zeros last", () => {
  const ordered = sortSourcesByRangeUsage([
    { id: "cursor", rangeKnownTokens: 0 },
    { id: "codex", rangeKnownTokens: 110 },
    { id: "pi", rangeKnownTokens: 50 },
    { id: "copilot", rangeKnownTokens: 110 },
    { id: "aider", rangeKnownTokens: null },
  ]).map((source) => source.id);

  assert.deepEqual(ordered, ["codex", "copilot", "pi", "aider", "cursor"]);
});

test("zero and missing usage sort after any known 下界 figure", () => {
  const ordered = sortSourcesByRangeUsage([
    { id: "empty", rangeKnownTokens: 0 },
    { id: "partial", rangeKnownTokens: 1 },
    { id: "absent" },
  ]).map((source) => source.id);

  assert.deepEqual(ordered, ["partial", "absent", "empty"]);
});

test("known Harness ids resolve to local logo paths, not remote URLs", () => {
  for (const id of HARNESS_LOGO_IDS) {
    const src = harnessLogoSrc(id);
    assert.equal(src, `/logos/${id}.svg`);
    assert.equal(src.startsWith("http"), false);
  }
  assert.equal(harnessLogoSrc("brand-new-harness"), null);
  assert.equal(harnessMarkFallback("brand-new-harness"), "BR");
  assert.equal(harnessMarkFallback(""), "?");
});

test("every mapped logo file is vendored under public/logos", async () => {
  const files = new Set(await readdir(path.join(ROOT, "public", "logos")));
  for (const id of HARNESS_LOGO_IDS) {
    assert.ok(files.has(`${id}.svg`), `${id}.svg should be vendored locally`);
  }
});
