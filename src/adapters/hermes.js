import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { exists, homePath } from "../lib/files.js";
import { makeRecord, number, usageTotal } from "../lib/usage.js";

const execFileAsync = promisify(execFile);

const MODEL_USAGE_QUERY = `
SELECT
  u.session_id AS session_id,
  u.model AS model,
  COALESCE(NULLIF(u.billing_provider, ''), NULLIF(s.billing_provider, ''), 'unknown') AS provider,
  COALESCE(u.api_call_count, 0) AS api_call_count,
  COALESCE(u.input_tokens, 0) AS input_tokens,
  COALESCE(u.output_tokens, 0) AS output_tokens,
  COALESCE(u.cache_read_tokens, 0) AS cache_read_tokens,
  COALESCE(u.cache_write_tokens, 0) AS cache_write_tokens,
  COALESCE(u.reasoning_tokens, 0) AS reasoning_tokens,
  COALESCE(u.last_seen, u.first_seen, s.ended_at, s.started_at) AS usage_timestamp
FROM session_model_usage u
LEFT JOIN sessions s ON s.id = u.session_id
WHERE
  COALESCE(u.input_tokens, 0) +
  COALESCE(u.output_tokens, 0) +
  COALESCE(u.cache_read_tokens, 0) +
  COALESCE(u.cache_write_tokens, 0) > 0
`;

const SESSION_FALLBACK_QUERY = `
SELECT
  id AS session_id,
  COALESCE(model, 'unknown') AS model,
  COALESCE(NULLIF(billing_provider, ''), 'unknown') AS provider,
  COALESCE(api_call_count, 0) AS api_call_count,
  COALESCE(input_tokens, 0) AS input_tokens,
  COALESCE(output_tokens, 0) AS output_tokens,
  COALESCE(cache_read_tokens, 0) AS cache_read_tokens,
  COALESCE(cache_write_tokens, 0) AS cache_write_tokens,
  COALESCE(reasoning_tokens, 0) AS reasoning_tokens,
  COALESCE(ended_at, started_at) AS usage_timestamp
FROM sessions
WHERE
  COALESCE(input_tokens, 0) +
  COALESCE(output_tokens, 0) +
  COALESCE(cache_read_tokens, 0) +
  COALESCE(cache_write_tokens, 0) > 0
`;

function profileName(filePath) {
  const parts = filePath.split(path.sep);
  const profileIndex = parts.lastIndexOf("profiles");
  return profileIndex >= 0 && parts[profileIndex + 1]
    ? parts[profileIndex + 1]
    : "default";
}

export function recordsFromHermesRows(rows, filePath) {
  const profile = profileName(filePath);
  const records = [];

  for (const row of rows) {
    const cacheRead = number(row.cache_read_tokens);
    const cacheWrite = number(row.cache_write_tokens);
    const record = makeRecord({
      timestamp: row.usage_timestamp,
      harness: "hermes",
      provider: row.provider,
      model: row.model,
      inputTokens: number(row.input_tokens) + cacheRead + cacheWrite,
      outputTokens: number(row.output_tokens),
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      reasoningTokens: number(row.reasoning_tokens),
      inputKnown: true,
      outputKnown: true,
      requests: number(row.api_call_count, 1),
      sessionId: `hermes:${profile}:${row.session_id}`,
    });
    if (usageTotal(record) > 0) records.push(record);
  }

  return records;
}

async function queryRows(filePath, query) {
  const { stdout } = await execFileAsync(
    "sqlite3",
    ["-readonly", "-json", filePath, query],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return stdout.trim() ? JSON.parse(stdout) : [];
}

async function profileDatabases(base) {
  const profileRoot = path.join(base, "profiles");
  let entries = [];
  try {
    entries = await readdir(profileRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const databases = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const database = path.join(profileRoot, entry.name, "state.db");
    if (await exists(database)) databases.push(database);
  }
  return databases;
}

export const hermesAdapter = {
  id: "hermes",
  name: "Hermes Agent",
  version: 1,
  coverage: "full",
  volatile: true,
  description: "读取默认与命名 profile 的 session_model_usage；按 session/model 的最后活动日归档。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".hermes");
    const mainDatabase = path.join(base, "state.db");
    const files = [];
    if (await exists(mainDatabase)) files.push(mainDatabase);
    files.push(...(await profileDatabases(base)));
    return {
      detected: await exists(base),
      files,
      displayPath: "~/.hermes/{state.db,profiles/*/state.db}",
    };
  },

  async parseFile(filePath) {
    let rows;
    try {
      rows = await queryRows(filePath, MODEL_USAGE_QUERY);
    } catch (error) {
      if (!String(error?.message || error).includes("no such table")) throw error;
      rows = await queryRows(filePath, SESSION_FALLBACK_QUERY);
    }
    return recordsFromHermesRows(rows, filePath);
  },
};
