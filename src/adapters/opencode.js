import { readFile } from "node:fs/promises";
import path from "node:path";
import { exists, homePath, listFiles } from "../lib/files.js";
import { hasNumber, makeRecord, number, usageTotal } from "../lib/usage.js";

function asMessages(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.messages)) return value.messages;
  return value ? [value] : [];
}

export const opencodeAdapter = {
  id: "opencode",
  name: "OpenCode",
  version: 1,
  coverage: "full",
  description: "支持 OpenCode JSON message storage；没有会话时保留为已检测数据源。",

  async discover(homeDir) {
    const dataRoot = homePath(homeDir, ".local", "share", "opencode");
    const configRoot = homePath(homeDir, ".config", "opencode");
    const storageRoot = homePath(dataRoot, "storage", "message");
    const files = await listFiles(storageRoot, (_, name) => name.endsWith(".json"));
    return {
      detected: (await exists(dataRoot)) || (await exists(configRoot)),
      files,
      displayPath: "~/.local/share/opencode/storage/message",
    };
  },

  async parseFile(filePath) {
    let value;
    try {
      value = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      return [];
    }

    const records = [];
    let index = 0;
    for (const message of asMessages(value)) {
      index += 1;
      if (message.role && message.role !== "assistant") continue;
      const tokens = message.tokens || message.usage || {};
      const cache = tokens.cache || {};
      const input = tokens.input ?? tokens.inputTokens;
      const output = tokens.output ?? tokens.outputTokens;
      const inputKnown = hasNumber(input);
      const outputKnown = hasNumber(output);
      if (!inputKnown && !outputKnown) continue;
      const record = makeRecord({
        timestamp:
          message.time?.completed ||
          message.time?.created ||
          message.timestamp ||
          message.createdAt,
        harness: "opencode",
        provider: message.providerID || message.providerId || message.provider,
        model: message.modelID || message.modelId || message.model,
        inputTokens: number(input),
        outputTokens: number(output),
        cacheReadTokens: number(cache.read ?? tokens.cacheRead),
        cacheWriteTokens: number(cache.write ?? tokens.cacheWrite),
        reasoningTokens: number(tokens.reasoning ?? tokens.reasoningTokens),
        inputKnown,
        outputKnown,
        sessionId:
          message.sessionID ||
          message.sessionId ||
          path.basename(path.dirname(filePath)),
        dedupeKey: `opencode:${message.id || `${filePath}:${index}`}`,
      });
      if (usageTotal(record) > 0) records.push(record);
    }
    return records;
  },
};
