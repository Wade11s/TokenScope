import path from "node:path";
import { exists, homePath, listFiles, readJsonLines } from "../lib/files.js";
import { hasNumber, makeRecord, number } from "../lib/usage.js";

export const copilotAdapter = {
  id: "copilot",
  name: "GitHub Copilot CLI",
  version: 1,
  coverage: "partial",
  description: "本地事件仅暴露输出 token；总量会显示为下限。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".copilot");
    const root = homePath(base, "session-state");
    const files = await listFiles(root, (_, name) => name === "events.jsonl");
    return {
      detected: await exists(base),
      files,
      displayPath: "~/.copilot/session-state/*/events.jsonl",
    };
  },

  async parseFile(filePath) {
    const records = [];
    const sessionId = path.basename(path.dirname(filePath));
    const relevant = (line) =>
      line.includes('"assistant.message"') && line.includes("outputTokens");

    for await (const event of readJsonLines(filePath, relevant)) {
      const data = event.data;
      if (event.type !== "assistant.message" || !hasNumber(data?.outputTokens)) {
        continue;
      }
      records.push(
        makeRecord({
          timestamp: event.timestamp,
          harness: "copilot",
          provider: "github-copilot",
          model: data.model,
          inputTokens: 0,
          outputTokens: number(data.outputTokens),
          inputKnown: false,
          outputKnown: true,
          sessionId,
          dedupeKey: `copilot:${data.messageId || event.id}`,
        }),
      );
    }
    return records;
  },
};
