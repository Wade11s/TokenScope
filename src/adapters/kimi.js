import path from "node:path";
import { exists, homePath, listFiles, readJsonLines } from "../lib/files.js";
import { hasNumber, makeRecord, number, usageTotal } from "../lib/usage.js";

export function splitKimiModel(value = "unknown") {
  const separator = value.indexOf("/");
  if (separator <= 0) return { provider: "kimi-code", model: value || "unknown" };
  return {
    provider: value.slice(0, separator),
    model: value.slice(separator + 1) || "unknown",
  };
}

function sessionIdentity(filePath) {
  const parts = filePath.split(path.sep);
  const agentsIndex = parts.lastIndexOf("agents");
  if (agentsIndex >= 1) {
    return {
      sessionId: parts[agentsIndex - 1],
      agentId: parts[agentsIndex + 1] || "main",
    };
  }
  return { sessionId: path.basename(path.dirname(filePath)), agentId: "main" };
}

export const kimiAdapter = {
  id: "kimi",
  name: "Kimi Code",
  version: 1,
  coverage: "full",
  description: "读取每个 agent wire 中可相加的 usage.record；忽略 context append 镜像。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".kimi-code");
    const root = homePath(base, "sessions");
    const files = await listFiles(root, (_, name) => name === "wire.jsonl");
    return {
      detected: await exists(base),
      files,
      displayPath: "~/.kimi-code/sessions/**/agents/*/wire.jsonl",
    };
  },

  async parseFile(filePath) {
    const records = [];
    const { sessionId, agentId } = sessionIdentity(filePath);
    let usageIndex = 0;

    for await (const event of readJsonLines(
      filePath,
      (line) => line.includes('"usage.record"'),
    )) {
      if (event.type !== "usage.record" || !event.usage) continue;
      usageIndex += 1;
      const usage = event.usage;
      const inputKnown =
        hasNumber(usage.inputOther) ||
        hasNumber(usage.inputCacheRead) ||
        hasNumber(usage.inputCacheCreation);
      const outputKnown = hasNumber(usage.output);
      if (!inputKnown && !outputKnown) continue;

      const cacheRead = number(usage.inputCacheRead);
      const cacheWrite = number(usage.inputCacheCreation);
      const identity = splitKimiModel(event.model);
      const record = makeRecord({
        timestamp: event.time,
        harness: "kimi",
        provider: identity.provider,
        model: identity.model,
        inputTokens: number(usage.inputOther) + cacheRead + cacheWrite,
        outputTokens: number(usage.output),
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        inputKnown,
        outputKnown,
        sessionId: `kimi:${sessionId}`,
        dedupeKey: `kimi:${sessionId}:${agentId}:${usageIndex}`,
      });
      if (usageTotal(record) > 0) records.push(record);
    }

    return records;
  },
};
