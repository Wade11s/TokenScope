import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adapters } from "./adapters/index.js";
import { exists, homePath, mapLimit } from "./lib/files.js";
import { compactRecords, dedupeRecords, usageTotal } from "./lib/usage.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_VERSION = 5;
export const DEFAULT_CACHE_PATH = path.join(
  PROJECT_ROOT,
  ".cache",
  "usage-index.json",
);

async function loadCache(cachePath, timezone) {
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8"));
    if (parsed.version !== CACHE_VERSION || parsed.timezone !== timezone) {
      return { files: {} };
    }
    return parsed;
  } catch {
    return { files: {} };
  }
}

async function saveCache(cachePath, timezone, files) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  const temporary = `${cachePath}.${process.pid}.tmp`;
  const payload = JSON.stringify({
    version: CACHE_VERSION,
    timezone,
    updatedAt: new Date().toISOString(),
    files,
  });
  await writeFile(temporary, payload, { mode: 0o600 });
  await rename(temporary, cachePath);
}

async function existsAny(paths) {
  const values = await Promise.all(paths.map((target) => exists(target)));
  return values.some(Boolean);
}

// Detect-only harnesses: TokenScope can notice these on disk but cannot
// parse them into token records. Exported so tests can pin the UI tooltip
// dictionaries to every known detect-only id; paths resolve per home dir.
export function detectOnlyDefinitions(homeDir) {
  return [
    {
      id: "cursor",
      name: "Cursor",
      paths: [
        homePath(homeDir, ".cursor"),
        homePath(homeDir, "Library", "Application Support", "Cursor"),
      ],
      displayPath: "~/.cursor",
      description: "检测到 Cursor，但本地 AI tracking 数据库不包含 token 用量。",
    },
    {
      id: "aider",
      name: "Aider",
      paths: [
        homePath(homeDir, ".aider"),
        homePath(homeDir, ".aider.conf.yml"),
      ],
      displayPath: "~/.aider*",
      description: "检测到 Aider，但未发现结构化 token usage 日志。",
    },
  ];
}

async function detectReadOnlySources(homeDir) {
  const sources = [];
  for (const definition of detectOnlyDefinitions(homeDir)) {
    if (await existsAny(definition.paths)) {
      sources.push({
        ...definition,
        detected: true,
        coverage: "unavailable",
        status: "unavailable",
        fileCount: 0,
        errors: [],
      });
    }
  }
  return sources;
}

export async function scanUsage({
  homeDir = os.homedir(),
  cachePath = DEFAULT_CACHE_PATH,
} = {}) {
  const startedAt = Date.now();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  const cache = await loadCache(cachePath, timezone);
  const nextCacheFiles = {};
  const cacheStats = {
    indexedFiles: 0,
    reusedFiles: 0,
    parsedFiles: 0,
    failedFiles: 0,
    durationMs: 0,
  };

  const discoveries = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        return { adapter, discovery: await adapter.discover(homeDir), error: null };
      } catch (error) {
        return {
          adapter,
          discovery: { detected: false, files: [], displayPath: "" },
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const jobs = discoveries.flatMap(({ adapter, discovery }) =>
    discovery.files.map((filePath) => ({ adapter, discovery, filePath })),
  );
  cacheStats.indexedFiles = jobs.length;

  const parsedJobs = await mapLimit(jobs, 4, async ({ adapter, discovery, filePath }) => {
    const cacheKey = `${adapter.id}:${filePath}`;
    const previous = cache.files?.[cacheKey];
    try {
      const fileStat = await stat(filePath);
      const fingerprint = [
        adapter.version,
        discovery.contextKey || "",
        fileStat.size,
        Math.trunc(fileStat.mtimeMs),
      ].join(":");

      if (
        !adapter.volatile &&
        previous?.fingerprint === fingerprint &&
        Array.isArray(previous.records)
      ) {
        cacheStats.reusedFiles += 1;
        nextCacheFiles[cacheKey] = previous;
        return { adapterId: adapter.id, records: previous.records, error: null };
      }

      const records = await adapter.parseFile(filePath, discovery.context);
      cacheStats.parsedFiles += 1;
      nextCacheFiles[cacheKey] = { fingerprint, records };
      return { adapterId: adapter.id, records, error: null };
    } catch (error) {
      cacheStats.failedFiles += 1;
      if (previous?.records) {
        nextCacheFiles[cacheKey] = previous;
      }
      return {
        adapterId: adapter.id,
        records: previous?.records || [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const recordsByAdapter = new Map(adapters.map((adapter) => [adapter.id, []]));
  const errorsByAdapter = new Map(adapters.map((adapter) => [adapter.id, []]));
  for (const result of parsedJobs) {
    recordsByAdapter.get(result.adapterId).push(...result.records);
    if (result.error) errorsByAdapter.get(result.adapterId).push(result.error);
  }

  const allRawRecords = [...recordsByAdapter.values()].flat();
  const records = compactRecords(dedupeRecords(allRawRecords));

  const sources = discoveries.map(({ adapter, discovery, error }) => {
    const sourceRecords = records.filter((record) => record.harness === adapter.id);
    const errors = errorsByAdapter.get(adapter.id);
    if (error) errors.push(error);
    const knownTokens = sourceRecords.reduce(
      (sum, record) => sum + usageTotal(record),
      0,
    );
    const lastSeen = sourceRecords.reduce(
      (latest, record) => Math.max(latest, record.timestamp),
      0,
    );
    let status = "absent";
    if (discovery.detected && sourceRecords.length === 0) status = "empty";
    if (sourceRecords.length > 0) {
      status = adapter.coverage === "full" ? "ready" : "partial";
    }
    if (errors.length > 0 && sourceRecords.length === 0) status = "error";

    return {
      id: adapter.id,
      name: adapter.name,
      detected: discovery.detected,
      coverage: adapter.coverage,
      status,
      fileCount: discovery.files.length,
      knownTokens,
      lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,
      displayPath: discovery.displayPath,
      description: adapter.description,
      errors: errors.slice(0, 3),
    };
  });

  sources.push(...(await detectReadOnlySources(homeDir)));

  try {
    await saveCache(cachePath, timezone, nextCacheFiles);
  } catch (error) {
    cacheStats.cacheWriteError = error instanceof Error ? error.message : String(error);
  }

  cacheStats.durationMs = Date.now() - startedAt;
  return {
    generatedAt: new Date().toISOString(),
    timezone,
    records,
    sources: sources.filter((source) => source.detected || source.knownTokens > 0),
    cache: cacheStats,
  };
}
