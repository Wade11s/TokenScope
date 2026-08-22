import { scanUsage } from "./indexer.js";
import { buildReport } from "./report.js";

function format(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

const rangeArgument = process.argv.find((value) => value.startsWith("--range="));
const range = rangeArgument?.split("=")[1] || "30d";
const asJson = process.argv.includes("--json");

const snapshot = await scanUsage();
const report = buildReport(snapshot, { range });

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `TokenScope · ${report.range.from || "无数据"} → ${report.range.to} · ${report.timezone}`,
  );
  console.log(
    `${report.summary.complete ? "可见 token" : "可见 token（至少）"}: ${format(report.summary.knownTokens)}`,
  );
  console.table(
    report.groups.map((group) => ({
      harness: group.harness,
      provider: group.provider,
      model: group.model,
      input: group.inputKnown ? format(group.inputTokens) : "不可见",
      output: group.outputKnown ? format(group.outputTokens) : "不可见",
      total: `${group.complete ? "" : "≥"}${format(group.knownTokens)}`,
      requests: group.requests,
    })),
  );
  console.log(
    `索引文件 ${report.cache.indexedFiles} · 复用 ${report.cache.reusedFiles} · 新解析 ${report.cache.parsedFiles} · ${report.cache.durationMs}ms`,
  );
}
