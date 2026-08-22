import path from "node:path";
import { exists, homePath, listFiles, readJsonLines } from "../lib/files.js";
import { hasNumber, makeRecord, number, usageTotal } from "../lib/usage.js";

export const ompAdapter = {
  id: "omp",
  name: "OMP",
  version: 1,
  coverage: "full",
  description: "统计 OMP 主/子 agent 的真实 assistant usage；忽略 orchestration custom 摘要。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".omp");
    const root = homePath(base, "agent", "sessions");
    const files = await listFiles(root, (_, name) => name.endsWith(".jsonl"));
    return {
      detected: await exists(base),
      files,
      displayPath: "~/.omp/agent/sessions/**/*.jsonl",
    };
  },

  async parseFile(filePath) {
    const records = [];
    let sessionId = path.basename(filePath, ".jsonl");
    let currentModel = { provider: "unknown", model: "unknown" };
    const modelByEntry = new Map();
    const relevant = (line) =>
      line.includes('"session"') ||
      line.includes('"model_change"') ||
      (line.includes('"compaction"') && line.includes('"usage"')) ||
      (line.includes('"message"') &&
        line.includes('"assistant"') &&
        line.includes('"usage"'));

    for await (const event of readJsonLines(filePath, relevant)) {
      if (event.type === "session") {
        sessionId = event.id || sessionId;
        continue;
      }

      const inheritedModel = modelByEntry.get(event.parentId) || currentModel;
      if (event.type === "model_change") {
        currentModel = {
          provider: event.provider || inheritedModel.provider,
          model: event.modelId || inheritedModel.model,
        };
        if (event.id) modelByEntry.set(event.id, currentModel);
        continue;
      }

      const message = event.message;
      const isAssistant = event.type === "message" && message?.role === "assistant";
      const isCompaction = event.type === "compaction" && event.usage;
      if (!isAssistant && !isCompaction) continue;
      const usage = isAssistant ? message.usage : event.usage;
      if (!usage) continue;
      const model = isAssistant
        ? {
            provider: message.provider || inheritedModel.provider,
            model: message.model || inheritedModel.model,
          }
        : inheritedModel;
      currentModel = model;
      if (event.id) modelByEntry.set(event.id, model);

      const inputKnown =
        hasNumber(usage.input) ||
        hasNumber(usage.cacheRead) ||
        hasNumber(usage.cacheWrite);
      const outputKnown = hasNumber(usage.output);
      if (!inputKnown && !outputKnown) continue;
      const cacheRead = number(usage.cacheRead);
      const cacheWrite = number(usage.cacheWrite);
      const responseIdentity = message?.responseId
        ? `response:${message.responseId}`
        : `${sessionId}:${event.id || message?.timestamp || event.timestamp}`;
      const record = makeRecord({
        timestamp: event.timestamp || message?.timestamp,
        harness: "omp",
        provider: model.provider,
        model: model.model,
        inputTokens: number(usage.input) + cacheRead + cacheWrite,
        outputTokens: number(usage.output),
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        reasoningTokens: number(usage.reasoningTokens ?? usage.reasoning),
        inputKnown,
        outputKnown,
        sessionId: `omp:${sessionId}`,
        dedupeKey: `omp:${responseIdentity}`,
      });
      if (usageTotal(record) > 0) records.push(record);
    }

    return records;
  },
};
