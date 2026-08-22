import path from "node:path";
import { exists, homePath, listFiles, readJsonLines } from "../lib/files.js";
import { hasNumber, makeRecord, number, usageTotal } from "../lib/usage.js";

function usageModels(usage) {
  const entries = Object.entries(usage.modelUsage || {});
  return entries.length > 0 ? entries : [["unknown", usage]];
}

export const grokAdapter = {
  id: "grok",
  name: "Grok CLI",
  version: 1,
  coverage: "full",
  description: "读取 turn_completed usage，并按 session/prompt/model 去重；缓存是 input 子集。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".grok");
    const root = homePath(base, "sessions");
    const files = await listFiles(root, (_, name) => name === "updates.jsonl");
    return {
      detected: await exists(base),
      files,
      displayPath: "~/.grok/sessions/**/updates.jsonl",
    };
  },

  async parseFile(filePath) {
    const records = [];
    const fallbackSession = path.basename(path.dirname(filePath));
    let usageIndex = 0;

    for await (const event of readJsonLines(
      filePath,
      (line) => line.includes('"usage"') && line.includes('"turn_completed"'),
    )) {
      const update = event.params?.update;
      const usage = update?.usage;
      if (!usage || update.sessionUpdate !== "turn_completed") continue;
      usageIndex += 1;
      const sessionId = event.params?.sessionId || fallbackSession;
      const promptId = update.prompt_id || `usage-${usageIndex}`;

      for (const [model, modelUsage] of usageModels(usage)) {
        const inputKnown = hasNumber(modelUsage.inputTokens);
        const outputKnown = hasNumber(modelUsage.outputTokens);
        if (!inputKnown && !outputKnown) continue;
        const record = makeRecord({
          timestamp: event.timestamp,
          harness: "grok",
          provider: "xai",
          model,
          inputTokens: number(modelUsage.inputTokens),
          outputTokens: number(modelUsage.outputTokens),
          cacheReadTokens: number(modelUsage.cachedReadTokens),
          cacheWriteTokens: number(modelUsage.cacheCreationTokens),
          reasoningTokens: number(modelUsage.reasoningTokens),
          inputKnown,
          outputKnown,
          requests: number(modelUsage.modelCalls, 1),
          sessionId: `grok:${sessionId}`,
          dedupeKey: `grok:${sessionId}:${promptId}:${model}`,
        });
        if (usageTotal(record) > 0) records.push(record);
      }
    }

    return records;
  },
};
