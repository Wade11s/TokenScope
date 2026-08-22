import { readFile } from "node:fs/promises";
import path from "node:path";
import { exists, homePath, listFiles } from "../lib/files.js";
import { hasNumber, makeRecord, number, usageTotal } from "../lib/usage.js";

function messagesFromSession(session) {
  if (Array.isArray(session)) return session;
  for (const key of ["messages", "history", "turns"]) {
    if (Array.isArray(session?.[key])) return session[key];
  }
  return [];
}

function usageFromMessage(message) {
  const usage = message.tokens || message.usageMetadata || message.usage || {};
  const input =
    usage.input ?? usage.inputTokens ?? usage.promptTokenCount ?? usage.promptTokens;
  const output =
    usage.output ??
    usage.outputTokens ??
    usage.candidatesTokenCount ??
    usage.completionTokens;
  const cacheRead =
    usage.cached ?? usage.cachedTokens ?? usage.cachedContentTokenCount ?? 0;
  const reasoning =
    usage.thoughts ?? usage.thoughtTokens ?? usage.thoughtsTokenCount ?? 0;
  return { input, output, cacheRead, reasoning };
}

export const geminiAdapter = {
  id: "gemini",
  name: "Gemini CLI",
  version: 1,
  coverage: "full",
  description: "读取 Gemini CLI 会话中的 usage metadata（若本地版本保存该字段）。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".gemini");
    const tmp = homePath(base, "tmp");
    const files = await listFiles(tmp, (filePath, name) => {
      return (
        name.endsWith(".json") &&
        (filePath.includes(`${path.sep}chats${path.sep}`) ||
          name.startsWith("session-"))
      );
    });
    return {
      detected: await exists(base),
      files,
      displayPath: "~/.gemini/tmp/*/chats/session-*.json",
    };
  },

  async parseFile(filePath) {
    let session;
    try {
      session = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      return [];
    }

    const sessionId = session.sessionId || path.basename(filePath, ".json");
    const defaultModel = session.model || session.modelId || "unknown";
    const records = [];
    let index = 0;
    for (const message of messagesFromSession(session)) {
      index += 1;
      const usage = usageFromMessage(message);
      const inputKnown = hasNumber(usage.input);
      const outputKnown = hasNumber(usage.output);
      if (!inputKnown && !outputKnown) continue;
      const record = makeRecord({
        timestamp:
          message.timestamp ||
          message.time?.completed ||
          message.time?.created ||
          session.lastUpdated ||
          session.startTime,
        harness: "gemini",
        provider: "google-gemini",
        model: message.model || message.modelId || defaultModel,
        inputTokens: number(usage.input),
        outputTokens: number(usage.output),
        cacheReadTokens: number(usage.cacheRead),
        reasoningTokens: number(usage.reasoning),
        inputKnown,
        outputKnown,
        sessionId,
        dedupeKey: `gemini:${message.id || `${sessionId}:${index}`}`,
      });
      if (usageTotal(record) > 0) records.push(record);
    }
    return records;
  },
};
