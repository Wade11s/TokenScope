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
  getLocale,
  normalizeLocale,
  t,
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
