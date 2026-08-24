import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  applyLocale,
  dictionaries,
  formatCompact,
  formatDateTime,
  formatDay,
  formatFull,
  formatMonthLabel,
  getLocale,
  has,
  normalizeLocale,
  t,
  weekdayMarkers,
} from "../public/i18n.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function markerKeys(html) {
  const keys = new Set();
  const pattern = /data-i18n(?:-aria|-attrs)?="([^"]*)"/g;
  for (const match of html.matchAll(pattern)) {
    const value = match[1];
    if (match[0].startsWith("data-i18n-attrs")) {
      value.split(",").forEach((entry) => {
        const separator = entry.indexOf(":");
        if (separator > 0) keys.add(entry.slice(separator + 1).trim());
      });
    } else {
      keys.add(value);
    }
  }
  return keys;
}

test("locale defaults to Chinese when no preference exists", () => {
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.equal(normalizeLocale(undefined), "zh");
  assert.equal(normalizeLocale("fr"), "zh");
  assert.equal(normalizeLocale("zh"), "zh");
  assert.equal(normalizeLocale("en"), "en");
});

test("zh and en dictionaries cover the same keys", () => {
  const zhKeys = new Set(Object.keys(dictionaries.zh));
  const enKeys = new Set(Object.keys(dictionaries.en));
  assert.deepEqual([...enKeys].filter((key) => !zhKeys.has(key)), []);
  assert.deepEqual([...zhKeys].filter((key) => !enKeys.has(key)), []);
});

test("every i18n marker in index.html resolves to a dictionary key", async () => {
  const html = await readFile(path.join(ROOT, "public", "index.html"), "utf8");
  const keys = markerKeys(html);
  assert.ok(keys.size >= 20, `expected a meaningful marker set, got ${keys.size}`);
  for (const key of keys) {
    assert.ok(
      Object.hasOwn(dictionaries.zh, key),
      `marker key "${key}" missing from zh dictionary`,
    );
    assert.ok(
      Object.hasOwn(dictionaries.en, key),
      `marker key "${key}" missing from en dictionary`,
    );
  }
});

test("t() translates for the current locale and falls back safely", () => {
  applyLocale("zh");
  assert.equal(getLocale(), "zh");
  assert.equal(t("nav.overview"), "总览");
  applyLocale("en");
  assert.equal(getLocale(), "en");
  assert.equal(t("nav.overview"), "Overview");
  assert.equal(t("title.rank"), "TokenScope · Rank");
  assert.equal(t("unknown.key"), "unknown.key");
  applyLocale("zh");
});

test("applyLocale keeps the supported set and ignores junk values", () => {
  assert.equal(applyLocale("en"), "en");
  assert.ok(SUPPORTED_LOCALES.includes(getLocale()));
  assert.equal(applyLocale("klingon"), "zh");
  assert.equal(getLocale(), "zh");
});

test("t() interpolates {named} placeholders in both locales", () => {
  applyLocale("zh");
  assert.equal(
    t("range.caption", { from: "1月1日", to: "1月7日", count: "3" }),
    "1月1日 — 1月7日 · 3 个会话",
  );
  assert.equal(t("bound.atLeast"), "至少");
  assert.equal(t("bound.exact"), "精确");
  applyLocale("en");
  assert.equal(
    t("range.caption", { from: "Jan 1", to: "Jan 7", count: "3" }),
    "Jan 1 — Jan 7 · 3 sessions",
  );
  assert.equal(t("drilldown.heading.name", { name: "Codex" }), "Drill-down · Codex");
  assert.equal(
    t("toast.scanFailed", { message: "boom" }),
    "Scan failed: boom",
  );
  // Unknown placeholders survive untouched instead of crashing renders.
  assert.equal(t("drilldown.link", {}), "Open {name} drill-down");
  applyLocale("zh");
});

test("dynamic-string keys used by app.js exist in both dictionaries", async () => {
  const source = await readFile(path.join(ROOT, "public", "app.js"), "utf8");
  const keys = new Set();
  for (const match of source.matchAll(/(?<![A-Za-z$.])t\("([a-z][a-z0-9.]*)"/g)) {
    keys.add(match[1]);
  }
  assert.ok(keys.size >= 30, `expected app.js to use many keys, got ${keys.size}`);
  for (const key of keys) {
    assert.ok(
      Object.hasOwn(dictionaries.zh, key),
      `app.js key "${key}" missing from zh dictionary`,
    );
    assert.ok(
      Object.hasOwn(dictionaries.en, key),
      `app.js key "${key}" missing from en dictionary`,
    );
  }
});

test("dates, months, and weekdays follow the current locale via Intl", () => {
  applyLocale("zh");
  assert.equal(formatDay("2026-03-05"), "3月5日");
  assert.equal(formatMonthLabel(new Date("2026-03-05T12:00:00")), "3月");
  assert.deepEqual(weekdayMarkers(), ["一", "", "三", "", "五", "", ""]);
  assert.match(formatDateTime(new Date("2026-03-05T15:04:00")), /3月5日/);

  applyLocale("en");
  assert.equal(formatDay("2026-03-05"), "Mar 5");
  assert.equal(formatMonthLabel(new Date("2026-03-05T12:00:00")), "Mar");
  assert.deepEqual(weekdayMarkers(), ["Mon", "", "Wed", "", "Fri", "", ""]);
  assert.match(formatDateTime(new Date("2026-03-05T15:04:00")), /Mar 5/);
  assert.equal(formatDay(""), t("range.noHistory"));
  applyLocale("zh");
});

test("full numbers keep western thousands separators and compact stays K/M/B/T", () => {
  for (const locale of ["zh", "en"]) {
    applyLocale(locale);
    assert.equal(formatFull(1234567), "1,234,567");
    assert.equal(formatCompact(1234), "1.2K");
    assert.equal(formatCompact(12_000), "12K");
    assert.equal(formatCompact(1_234_567), "1.2M");
    assert.equal(formatCompact(1_500_000_000), "1.5B");
    assert.equal(formatCompact(2_300_000_000_000), "2.3T");
    assert.equal(formatCompact(1.24), "1.2");
    assert.doesNotMatch(formatCompact(12_000), /[万亿]/);
  }
  applyLocale("zh");
});

test("app.js contains no hardcoded CJK copy", async () => {
  const source = await readFile(path.join(ROOT, "public", "app.js"), "utf8");
  const offenders = source
    .split("\n")
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /[\u4e00-\u9fff\uff00-\uffef]/.test(line));
  assert.deepEqual(
    offenders.map(({ index }) => index + 1),
    [],
    "app.js must render all CJK copy through the i18n dictionaries",
  );
});

const KNOWN_HARNESS_IDS = [
  "codex",
  "claude",
  "gemini",
  "grok",
  "kimi",
  "pi",
  "hermes",
  "droid",
  "fx",
  "copilot",
  "continue",
  "omp",
  "opencode",
  "cursor",
  "aider",
];

// The dashboard source catalog as scanUsage would build it: every adapter
// plus every detect-only definition. Detect-only ids must not drift from
// this list without a matching dictionary entry.
async function knownSources() {
  const { adapters } = await import("../src/adapters/index.js");
  const { detectOnlyDefinitions } = await import("../src/indexer.js");
  const homeDir = "/home/tester";
  const sources = adapters.map((adapter) => ({
    id: adapter.id,
    description: adapter.description,
  }));
  for (const definition of detectOnlyDefinitions(homeDir)) {
    sources.push({ id: definition.id, description: definition.description });
  }
  return sources;
}

test("every known harness id resolves a tooltip description in both locales", async () => {
  const sources = await knownSources();
  assert.deepEqual(
    sources.map((source) => source.id).sort(),
    [...KNOWN_HARNESS_IDS].sort(),
    "the source catalog changed; update the expected id list and its dictionaries",
  );
  for (const source of sources) {
    const key = `source.desc.${source.id}`;
    assert.ok(
      Object.hasOwn(dictionaries.zh, key),
      `zh dictionary missing "${key}"`,
    );
    assert.ok(
      Object.hasOwn(dictionaries.en, key),
      `en dictionary missing "${key}"`,
    );
    assert.ok(has(key), `has() must resolve "${key}"`);
  }
});

test("zh tooltip descriptions stay in sync with backend source metadata", async () => {
  applyLocale("zh");
  const sources = await knownSources();
  for (const source of sources) {
    assert.equal(
      t(`source.desc.${source.id}`),
      source.description,
      `zh dictionary copy for "${source.id}" drifted from its adapter metadata`,
    );
  }
  applyLocale("zh");
});

test("en tooltip descriptions contain no leftover Chinese", async () => {
  applyLocale("en");
  for (const [key, value] of Object.entries(dictionaries.en)) {
    if (!key.startsWith("source.desc.")) continue;
    assert.doesNotMatch(
      value,
      /[\u4e00-\u9fff\uff00-\uffef]/,
      `en "${key}" must be fully translated`,
    );
  }
  assert.equal(t("source.desc.codex"), dictionaries.en["source.desc.codex"]);
  applyLocale("zh");
});

test("unknown harness ids get a generic localized tooltip fallback", () => {
  assert.ok(!has("source.desc.brand-new-harness"));
  applyLocale("en");
  assert.equal(
    t("source.desc.fallback"),
    "Local usage data for this harness.",
  );
  applyLocale("zh");
  assert.equal(t("source.desc.fallback"), "该 Harness 的本地用量数据。");
});

test("coverage tooltips render descriptions through the dictionaries only", async () => {
  const source = await readFile(path.join(ROOT, "public", "app.js"), "utf8");
  assert.doesNotMatch(
    source,
    /source\.description/,
    "coverageTooltip must not paste raw backend zh metadata into tooltips",
  );
  assert.match(source, /source\.desc\./, "tooltips should resolve source.desc.* keys");
});
