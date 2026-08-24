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
