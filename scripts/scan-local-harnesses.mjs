#!/usr/bin/env node
// Research scanner: On Path / Configured / Usage logs for the harness catalog.
// Not part of TokenScope's product indexer. See docs/adr/0001-coverage-inventory-is-research.md

import { readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(SCRIPT_DIR, "harness-catalog.json");
const HOME = process.env.HOME || os.homedir();

const jsonFlag = process.argv.includes("--json");

function loadCatalog() {
  const parsed = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  if (!Array.isArray(parsed.harnesses)) {
    throw new Error("harness-catalog.json is missing harnesses[]");
  }
  return parsed;
}

function pathEntries() {
  return (process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean)
    .filter((entry) => !entry.startsWith("~"));
}

function resolveBinary(name) {
  if (!name || name.includes("/") || name.includes("\\")) return null;
  for (const dir of pathEntries()) {
    const candidate = path.join(dir, name);
    try {
      const st = statSync(candidate);
      if (st.isFile()) return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

function expandHome(relativePath) {
  return path.join(HOME, relativePath);
}

function exists(target) {
  try {
    statSync(target);
    return true;
  } catch {
    return false;
  }
}

function globToRegExp(pattern) {
  const withStars = pattern
    .replaceAll("**/", "\u0000")
    .replaceAll("**", "\u0000")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", "[^/]*")
    .replaceAll("\u0000", "(?:.*/)?");
  return new RegExp(`^${withStars}$`);
}

function walkFiles(root, maxFiles = 5000) {
  const files = [];
  if (!exists(root)) return files;
  const stack = [root];
  while (stack.length && files.length < maxFiles) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) files.push(full);
      if (files.length >= maxFiles) break;
    }
  }
  return files;
}

function countUsage(homeRelativeGlobs) {
  let count = 0;
  const matched = [];
  for (const pattern of homeRelativeGlobs) {
    const normalized = pattern.replaceAll("\\", "/");
    const firstStar = normalized.search(/[*]/);
    const literal = firstStar === -1 ? normalized : normalized.slice(0, normalized.lastIndexOf("/", firstStar));
    const rootRel = literal || ".";
    const root = expandHome(rootRel);
    const rx = globToRegExp(normalized);
    const files = walkFiles(exists(root) && statSync(root).isDirectory() ? root : path.dirname(root));
    for (const file of files) {
      const rel = path.relative(HOME, file).split(path.sep).join("/");
      if (rx.test(rel)) {
        count += 1;
        if (matched.length < 3) matched.push(`~/${rel}`);
      }
    }
  }
  return { count, samples: matched };
}

function scanHarness(harness) {
  const binaries = [];
  for (const name of harness.binaries || []) {
    const resolved = resolveBinary(name);
    if (resolved) binaries.push({ name, path: resolved });
  }

  const configs = [];
  for (const rel of harness.configPaths || []) {
    const full = expandHome(rel);
    if (exists(full)) configs.push(`~/${rel}`);
  }

  const usage = countUsage(harness.usageGlobs || []);

  return {
    id: harness.id,
    name: harness.name,
    tokenscope: harness.tokenscope,
    tags: harness.tags || [],
    sources: harness.sources || [],
    stars: harness.stars ?? null,
    onPath: binaries.length > 0,
    configured: configs.length > 0,
    usageLogs: usage.count > 0,
    binaries,
    configHits: configs,
    usageFileCount: usage.count,
    usageSamples: usage.samples,
  };
}

function classify(row) {
  if (row.tokenscope === "adapter") return "adapter";
  if (row.tokenscope === "detect-only") return "detect-only";
  if (row.usageLogs) return "gap-usage-logs";
  if (row.onPath || row.configured) return "gap-present-no-logs";
  return "absent";
}

const catalog = loadCatalog();
const rows = catalog.harnesses.map(scanHarness).sort((a, b) => {
  const rank = { adapter: 0, "detect-only": 1, "gap-usage-logs": 2, "gap-present-no-logs": 3, absent: 4 };
  return (rank[classify(a)] - rank[classify(b)]) || a.id.localeCompare(b.id);
});

const report = {
  scannedAt: new Date().toISOString(),
  home: "~",
  catalogRules: catalog.rules,
  counts: {
    catalog: rows.length,
    onPath: rows.filter((r) => r.onPath).length,
    configured: rows.filter((r) => r.configured).length,
    usageLogs: rows.filter((r) => r.usageLogs).length,
    adapter: rows.filter((r) => r.tokenscope === "adapter").length,
    detectOnly: rows.filter((r) => r.tokenscope === "detect-only").length,
    gapUsageLogs: rows.filter((r) => classify(r) === "gap-usage-logs").length,
    gapPresentNoLogs: rows.filter((r) => classify(r) === "gap-present-no-logs").length,
  },
  rows: rows.map((row) => ({ ...row, class: classify(row) })),
};

if (jsonFlag) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

const flag = (value) => (value ? "yes" : "no");
process.stdout.write(
  [
    `catalog ${report.counts.catalog}  on_path ${report.counts.onPath}  configured ${report.counts.configured}  usage_logs ${report.counts.usageLogs}`,
    `adapter ${report.counts.adapter}  detect-only ${report.counts.detectOnly}  gap-usage-logs ${report.counts.gapUsageLogs}  gap-present-no-logs ${report.counts.gapPresentNoLogs}`,
    "",
    ["id", "on_path", "configured", "usage_logs", "files", "tokenscope", "class"].join("\t"),
    ...report.rows.map((row) =>
      [row.id, flag(row.onPath), flag(row.configured), flag(row.usageLogs), row.usageFileCount, row.tokenscope, row.class].join("\t"),
    ),
    "",
  ].join("\n"),
);
