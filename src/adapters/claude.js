import { readFile } from "node:fs/promises";
import path from "node:path";
import { exists, homePath, listFiles, readJsonLines } from "../lib/files.js";
import { hasNumber, makeRecord, number, usageTotal } from "../lib/usage.js";

const PROVIDER_HOSTS = [
  [/anthropic\.com$/i, "anthropic"],
  [/(^|\.)kimi\.com$|moonshot/i, "moonshot"],
  [/minimax/i, "minimax"],
  [/(^|\.)z\.ai$|bigmodel/i, "z-ai"],
  [/openrouter/i, "openrouter"],
  [/deepseek/i, "deepseek"],
  [/localhost|127\.0\.0\.1|::1/i, "local-proxy"],
];

async function readSettings(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

export function providerFromClaudeEnvironment(environment = {}) {
  if (String(environment.CLAUDE_CODE_USE_BEDROCK).toLowerCase() === "true") {
    return { provider: "amazon-bedrock", inferred: false };
  }
  if (String(environment.CLAUDE_CODE_USE_VERTEX).toLowerCase() === "true") {
    return { provider: "google-vertex", inferred: false };
  }
  if (String(environment.CLAUDE_CODE_USE_FOUNDRY).toLowerCase() === "true") {
    return { provider: "azure-foundry", inferred: false };
  }

  const baseUrl = environment.ANTHROPIC_BASE_URL;
  if (!baseUrl) return { provider: "anthropic", inferred: true };

  try {
    const hostname = new URL(baseUrl).hostname;
    for (const [pattern, provider] of PROVIDER_HOSTS) {
      if (pattern.test(hostname)) return { provider, inferred: true };
    }
    return { provider: "anthropic-compatible", inferred: true };
  } catch {
    return { provider: "anthropic-compatible", inferred: true };
  }
}

export function providerForClaudeModel(model, configured) {
  if (/^(us\.|eu\.|apac\.)?anthropic\./i.test(model)) {
    return { provider: "amazon-bedrock", inferred: false };
  }
  if (/@\d{8}$/.test(model)) {
    return { provider: "google-vertex", inferred: false };
  }
  return configured;
}

export const claudeAdapter = {
  id: "claude",
  name: "Claude Code",
  version: 3,
  coverage: "full",
  description: "按 message id 合并流式记录，避免重复计算。Provider 可能由当前配置推断。",

  async discover(homeDir) {
    const base = homePath(homeDir, ".claude");
    const root = homePath(base, "projects");
    const files = await listFiles(root, (_, name) => name.endsWith(".jsonl"));
    const globalSettings = await readSettings(homePath(base, "settings.json"));
    const localSettings = await readSettings(homePath(base, "settings.local.json"));
    const environment = {
      ...(globalSettings.env || {}),
      ...(localSettings.env || {}),
    };
    for (const key of [
      "ANTHROPIC_BASE_URL",
      "CLAUDE_CODE_USE_BEDROCK",
      "CLAUDE_CODE_USE_VERTEX",
      "CLAUDE_CODE_USE_FOUNDRY",
    ]) {
      if (process.env[key] !== undefined) environment[key] = process.env[key];
    }
    const provider = providerFromClaudeEnvironment(environment);

    return {
      detected: await exists(base),
      files,
      displayPath: "~/.claude/projects",
      context: provider,
      contextKey: `${provider.provider}:${provider.inferred}`,
    };
  },

  async parseFile(filePath, context = { provider: "anthropic", inferred: true }) {
    const records = [];
    const fallbackSession = path.basename(filePath, ".jsonl");
    const relevant = (line) =>
      line.includes('"assistant"') && line.includes('"usage"');

    for await (const event of readJsonLines(filePath, relevant)) {
      const message = event.message;
      const usage = message?.usage;
      if (event.type !== "assistant" || !usage) continue;

      const hasInput =
        hasNumber(usage.input_tokens) ||
        hasNumber(usage.cache_creation_input_tokens) ||
        hasNumber(usage.cache_read_input_tokens);
      const hasOutput = hasNumber(usage.output_tokens);
      if (!hasInput && !hasOutput) continue;

      const configuredProvider = providerForClaudeModel(
        message.model || "unknown",
        context,
      );
      const cacheWrite = number(usage.cache_creation_input_tokens);
      const cacheRead = number(usage.cache_read_input_tokens);
      const record = makeRecord({
        timestamp: event.timestamp,
        harness: "claude",
        provider: configuredProvider.provider,
        providerInferred: configuredProvider.inferred,
        model: message.model,
        inputTokens: number(usage.input_tokens) + cacheWrite + cacheRead,
        outputTokens: number(usage.output_tokens),
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        inputKnown: hasInput,
        outputKnown: hasOutput,
        sessionId: event.sessionId || fallbackSession,
        dedupeKey: `claude:${message.id || event.uuid}`,
      });
      if (usageTotal(record) > 0) records.push(record);
    }

    return records;
  },
};
