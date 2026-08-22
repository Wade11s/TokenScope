import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { exists, homePath, listFiles } from "../lib/files.js";
import { hasNumber, makeRecord, number, usageTotal } from "../lib/usage.js";

export function splitFxModel(value = "") {
  const text = String(value || "").trim();
  if (!text) return { provider: undefined, model: undefined };
  const separator = text.indexOf("/");
  if (separator <= 0) return { provider: undefined, model: text };
  return {
    provider: text.slice(0, separator),
    model: text.slice(separator + 1) || undefined,
  };
}

async function fileTimestamp(filePath) {
  try {
    return (await stat(filePath)).mtimeMs;
  } catch {
    return undefined;
  }
}

function recordFromUsage({ usage, sessionId, modelValue, timestamp, suffix }) {
  const inputKnown = hasNumber(usage.input_tokens);
  const outputKnown = hasNumber(usage.output_tokens);
  if (!inputKnown && !outputKnown) return null;

  const identity = splitFxModel(modelValue);
  const record = makeRecord({
    timestamp,
    harness: "fx",
    provider: identity.provider,
    model: identity.model,
    inputTokens: number(usage.input_tokens),
    outputTokens: number(usage.output_tokens),
    cacheReadTokens: number(usage.cache_read_tokens),
    cacheWriteTokens: number(usage.cache_write_tokens),
    reasoningTokens: number(usage.reasoning_tokens),
    inputKnown,
    outputKnown,
    requests: hasNumber(usage.request_count) ? number(usage.request_count) : 1,
    sessionId,
    dedupeKey: suffix ? `fx:${sessionId}:${suffix}` : `fx:${sessionId}`,
  });
  return usageTotal(record) > 0 ? record : null;
}

export const fxAdapter = {
  id: "fx",
  name: "fx (Vercel)",
  version: 1,
  coverage: "partial",
  description:
    "读取会话 usage-v2.json 快照；cache/reasoning 是 input/output 子集。有 models[] 时按 provider/model 拆分，否则记 unknown。根 usage.jsonl 无 token 字段。billing 可能 incomplete，按下限处理。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".fx");
    const root = homePath(base, "sessions");
    const files = await listFiles(root, (_, name) => name === "usage-v2.json");
    return {
      detected: await exists(base),
      files,
      displayPath: "~/.fx/sessions/**/usage-v2.json",
    };
  },

  async parseFile(filePath) {
    const name = path.basename(filePath);
    if (name === "usage.jsonl" || name === "events.jsonl" || name === "session.json") {
      return [];
    }

    let value;
    try {
      value = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      return [];
    }

    const snapshot = value?.snapshot;
    if (!snapshot || typeof snapshot !== "object") return [];

    const sessionId = `fx:${value.session_id || path.basename(path.dirname(filePath))}`;
    const timestamp = await fileTimestamp(filePath);
    const models = Array.isArray(snapshot.models)
      ? snapshot.models.filter((item) => item && typeof item === "object")
      : [];

    const records = [];
    for (const item of models) {
      const record = recordFromUsage({
        usage: item,
        sessionId,
        modelValue: item.model,
        timestamp,
        suffix: item.model || "unknown",
      });
      if (record) records.push(record);
    }
    if (records.length > 0) return records;

    const rollup = recordFromUsage({
      usage: snapshot,
      sessionId,
      timestamp,
    });
    return rollup ? [rollup] : [];
  },
};
