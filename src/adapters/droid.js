import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { exists, homePath, listFiles } from "../lib/files.js";
import {
  hasNumber,
  makeRecord,
  number,
  subtractUsage,
  usageTotal,
} from "../lib/usage.js";

function factoryUsageFields(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputKnown = hasNumber(usage.inputTokens);
  const outputKnown = hasNumber(usage.outputTokens);
  if (!inputKnown && !outputKnown) return null;
  return {
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cached_input_tokens: usage.cacheReadTokens,
    cache_write_input_tokens: usage.cacheCreationTokens,
    reasoning_output_tokens: usage.thinkingTokens,
    total_tokens: number(usage.inputTokens) + number(usage.outputTokens),
    inputKnown,
    outputKnown,
  };
}

function snapshotUsage(snapshot) {
  return (
    factoryUsageFields(snapshot?.tokenUsage) ||
    factoryUsageFields(snapshot?.inclusiveTokenUsage)
  );
}

function snapshotsFrom(parsed) {
  if (Array.isArray(parsed)) return parsed.filter((item) => item && typeof item === "object");
  if (parsed && typeof parsed === "object") return [parsed];
  return [];
}

export const droidAdapter = {
  id: "droid",
  name: "Droid CLI",
  version: 1,
  coverage: "partial",
  description:
    "读取 Factory session *.settings.json 的 tokenUsage 累计快照并按 Codex 方式取增量；不用 inclusiveTokenUsage 与自身用量相加。无请求级时间戳，provider 记为 factory，请求数为下限。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".factory");
    const root = homePath(base, "sessions");
    const files = await listFiles(root, (_, name) => name.endsWith(".settings.json"));
    return {
      detected: await exists(base),
      files,
      displayPath: "~/.factory/sessions/**/*.settings.json",
    };
  },

  async parseFile(filePath) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      return [];
    }

    const sessionId = path.basename(filePath, ".settings.json");
    let timestamp;
    try {
      timestamp = (await stat(filePath)).mtimeMs;
    } catch {
      timestamp = Date.now();
    }

    const records = [];
    let previousTotal = {};
    let index = 0;

    for (const snapshot of snapshotsFrom(parsed)) {
      const total = snapshotUsage(snapshot);
      if (!total) continue;
      index += 1;
      const usage = subtractUsage(total, previousTotal);
      previousTotal = total;
      const record = makeRecord({
        timestamp,
        harness: "droid",
        provider: "factory",
        providerInferred: true,
        model: snapshot.model || "unknown",
        ...usage,
        inputKnown: total.inputKnown,
        outputKnown: total.outputKnown,
        requests: 1,
        sessionId: `droid:${sessionId}`,
        dedupeKey: `droid:${sessionId}:${index}`,
      });
      if (usageTotal(record) > 0) records.push(record);
    }

    return records;
  },
};
