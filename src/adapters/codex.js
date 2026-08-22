import path from "node:path";
import { exists, homePath, listFiles, readJsonLines } from "../lib/files.js";
import {
  compactRecords,
  makeRecord,
  subtractUsage,
  usageTotal,
} from "../lib/usage.js";

export const codexAdapter = {
  id: "codex",
  name: "Codex",
  version: 2,
  coverage: "full",
  description: "输入、输出、缓存与推理 token；包含活跃和归档会话。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".codex");
    const roots = [homePath(base, "sessions"), homePath(base, "archived_sessions")];
    const groups = await Promise.all(
      roots.map((root) => listFiles(root, (_, name) => name.endsWith(".jsonl"))),
    );
    return {
      detected: await exists(base),
      files: groups.flat(),
      displayPath: "~/.codex/{sessions,archived_sessions}",
    };
  },

  async parseFile(filePath) {
    let provider = "openai";
    let model = "unknown";
    let sessionId = path.basename(filePath, ".jsonl");
    let previousTotal = {};
    const records = [];

    const relevant = (line) =>
      line.includes('"session_meta"') ||
      line.includes('"turn_context"') ||
      (line.includes('"event_msg"') && line.includes('"token_count"'));

    for await (const event of readJsonLines(filePath, relevant)) {
      if (event.type === "session_meta") {
        provider = event.payload?.model_provider || provider;
        sessionId = event.payload?.id || sessionId;
        continue;
      }

      if (event.type === "turn_context") {
        model = event.payload?.model || model;
        continue;
      }

      if (event.type !== "event_msg" || event.payload?.type !== "token_count") {
        continue;
      }

      const total = event.payload?.info?.total_token_usage;
      if (!total) continue;

      const usage = subtractUsage(total, previousTotal);
      previousTotal = total;
      const record = makeRecord({
        timestamp: event.timestamp,
        harness: "codex",
        provider,
        model,
        ...usage,
        inputKnown: true,
        outputKnown: true,
        requests: 1,
        sessionId,
      });
      if (usageTotal(record) > 0) records.push(record);
    }

    return compactRecords(records);
  },
};
