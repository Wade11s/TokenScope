import path from "node:path";
import { exists, homePath, listFiles, readJsonLines } from "../lib/files.js";
import { hasNumber, makeRecord, number, usageTotal } from "../lib/usage.js";

export const continueAdapter = {
  id: "continue",
  name: "Continue",
  version: 1,
  coverage: "full",
  description: "读取 Continue 本地 dev_data 中的 prompt/generated token 事件。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".continue");
    const root = homePath(base, "dev_data");
    const files = await listFiles(
      root,
      (filePath, name) =>
        name === "tokensGenerated.jsonl" && !filePath.includes("node_modules"),
    );
    return {
      detected: await exists(base),
      files,
      displayPath: "~/.continue/dev_data/*/tokensGenerated.jsonl",
    };
  },

  async parseFile(filePath) {
    const records = [];
    let index = 0;
    for await (const event of readJsonLines(
      filePath,
      (line) => line.includes('"tokensGenerated"'),
    )) {
      index += 1;
      const inputKnown = hasNumber(event.promptTokens);
      const outputKnown = hasNumber(event.generatedTokens);
      if (!inputKnown && !outputKnown) continue;
      const record = makeRecord({
        timestamp: event.timestamp,
        harness: "continue",
        provider: event.provider,
        model: event.model,
        inputTokens: number(event.promptTokens),
        outputTokens: number(event.generatedTokens),
        inputKnown,
        outputKnown,
        sessionId: event.selectedProfileId || path.basename(path.dirname(filePath)),
        dedupeKey: `continue:${filePath}:${index}`,
      });
      if (usageTotal(record) > 0) records.push(record);
    }
    return records;
  },
};
