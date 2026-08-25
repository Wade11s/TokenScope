// Static-chrome i18n core for TokenScope (WADE-24).
//
// Owns the zh/en dictionaries for copy that lives in index.html, the
// topbar locale dropdown, localStorage persistence, and <html lang> sync.
// Dynamic JS-built strings (status labels, empty states, toasts, drill-down
// document.title) render through t(key, params) via the bridge (WADE-25);
// {name} placeholders in dictionary values are interpolated by t().
// Locale-aware date/month formatters (WADE-26) live here so both
// the static bindings and app.js share one Intl locale. Numbers come from
// public/format.js (complete figures / English compact scale) and are
// re-exported on the bridge. Harness coverage tooltip descriptions
// (WADE-27) resolve through source.desc.<id> keys plus a generic
// source.desc.fallback so EN hovers never leak backend zh metadata.
//
// Loaded as a module script placed before app.js. Module scripts defer by
// default and keep document order with other deferred scripts, so the
// `window.tokenscopeI18n` bridge exists before app.js runs. The bridge is
// also exposed because app.js is a classic script and cannot import.

import {
  compactScale,
  formatAxisTick,
  formatCompact,
  formatFull,
  formatKnown,
  formatMetric,
} from "./format.js";

export const SUPPORTED_LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "zh";
export const STORAGE_KEY = "tokenscope.locale";
export const LOCALE_CHANGE_EVENT = "tokenscope:localechange";

export {
  compactScale,
  formatAxisTick,
  formatCompact,
  formatFull,
  formatKnown,
  formatMetric,
};

const HTML_LANGS = { zh: "zh-CN", en: "en" };

let dateFormatter;
let monthFormatter;
let timeFormatter;
let currentLocale = DEFAULT_LOCALE;

function intlLocale() {
  return HTML_LANGS[currentLocale] || HTML_LANGS[DEFAULT_LOCALE];
}

function rebuildDateFormatters() {
  const loc = intlLocale();
  dateFormatter = new Intl.DateTimeFormat(loc, {
    month: "short",
    day: "numeric",
  });
  monthFormatter = new Intl.DateTimeFormat(loc, { month: "short" });
  timeFormatter = new Intl.DateTimeFormat(loc, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

rebuildDateFormatters();

export const dictionaries = {
  zh: {
    "doc.title": "TokenScope · 个人用量",
    "doc.description": "TokenScope — 本机 AI coding harness 个人用量中心",
    "brand.subtitle": "个人用量",
    "brand.link.aria": "TokenScope 个人用量总览",
    "nav.aria": "视图导航",
    "nav.overview": "总览",
    "nav.rank": "排行",
    "privacy.pill": "本机 · 不上传",
    "range.aria": "统计时间范围",
    "range.today": "今天",
    "range.7d": "7 天",
    "range.30d": "30 天",
    "range.90d": "90 天",
    "range.all": "全部",
    "action.refresh": "刷新",
    "lang.select.aria": "语言",
    "lang.zh": "中文",
    "lang.en": "English",
    "view.overview.aria": "总览",
    "view.rank.aria": "排行",
    "view.harness.aria": "Harness 下钻",
    "overview.heading": "个人用量",
    "status.indexing": "正在建立本地索引…",
    "metric.token": "Token",
    "metric.input": "输入",
    "metric.output": "输出",
    "metric.cache": "缓存",
    "metric.requests": "请求",
    "metric.input.note": "含缓存读写",
    "metric.cache.read": "读取",
    "panel.trend": "每日趋势",
    "legend.aria": "图例",
    "legend.input": "输入",
    "legend.output": "输出",
    "trend.chart.aria": "每日 token 消耗柱状图，输入和输出使用独立刻度",
    "trend.empty": "这个时间范围内还没有可见用量。",
    "panel.composition": "构成",
    "composition.aria": "构成维度",
    "composition.providers": "按 Provider",
    "composition.models": "Model",
    "composition.harnesses": "Harness",
    "panel.activity.aria": "用量活动",
    "panel.activity": "活动",
    "activity.legend.less": "少",
    "activity.legend.more": "多",
    "panel.harness": "Harness",
    "status.waitingScan": "等待扫描",
    "rank.heading": "排行",
    "rank.panel": "谁在前列",
    "rank.aria": "排行维度",
    "col.dimension": "Provider",
    "col.share": "份额",
    "col.usage": "用量",
    "col.requests": "请求",
    "col.model": "Model",
    "col.provider": "Provider",
    "drilldown.heading": "下钻",
    "drilldown.token.note": "可见输入 + 输出 token 合计",
    "drilldown.output.note": "模型生成输出",
    "drilldown.providers.panel": "Provider 构成",
    "drilldown.models.panel": "Model 明细",
    "footer.privacy": "本机读取用量元数据，不上传日志，不读正文。",
    "loading.title": "正在扫描本机日志",
    "loading.note": "首次索引后只处理变化的文件。",
    "title.overview": "TokenScope · 个人用量",
    "title.rank": "TokenScope · 排行",
    "title.drilldown": "TokenScope · 下钻",
    "status.ready": "完整",
    "status.partial": "部分",
    "status.empty": "暂无记录",
    "status.unavailable": "不可统计",
    "status.error": "读取失败",
    "status.absent": "未检出",
    "bound.atLeast": "至少",
    "bound.exact": "精确",
    "range.noHistory": "无历史数据",
    "range.caption": "{from} — {to} · {count} 个会话",
    "range.dates": "{from} — {to}",
    "sessions.count": "{count} 个会话",
    "requests.count": "{count} 次请求",
    "tokens.count": "{count} token",
    "cache.note.exact": "可见输入 token 中的缓存读取占比",
    "cache.note.partial": "输入不完整时仍按可见输入计算缓存率",
    "cache.rate": "缓存率 {value}",
    "cache.rate.empty": "缓存率 —",
    "cache.read": "缓存读取 {value}",
    "cache.read.empty": "缓存读取 —",
    "activity.empty": "暂无活动数据。",
    "activity.aria":
      "过去 12 个月 token 活动热力图：{days} 天有用量，合计 {tokens}",
    "activity.summary.none": "过去 12 个月没有可见用量。",
    "activity.summary":
      "过去 12 个月 {active} 天活跃 · 最长连续 {longest} 天 · 当前连续 {current} 天",
    "activity.tooltip.usage": "{day} · {tokens} · {requests}",
    "activity.tooltip.none": "{day} · 无用量",
    "empty.composition": "暂无构成数据。",
    "empty.rank": "暂无排行数据。",
    "empty.harnessDetail": "暂无 Harness 明细。",
    "empty.providers": "暂无 Provider 数据。",
    "empty.models": "暂无 Model 数据。",
    "drilldown.link": "查看 {name} 下钻",
    "drilldown.heading.name": "下钻 · {name}",
    "rank.share.aria": "份额为榜首行的 {percent}%",
    "source.selected": "已选中",
    "source.unselected": "未选中",
    "source.checkbox.aria": "{name}，{tokens}，{state}",
    "source.desc.codex": "输入、输出、缓存与推理 token；包含活跃和归档会话。",
    "source.desc.claude": "按 message id 合并流式记录，避免重复计算。Provider 可能由当前配置推断。",
    "source.desc.gemini": "读取 Gemini CLI 会话中的 usage metadata（若本地版本保存该字段）。",
    "source.desc.grok": "读取 turn_completed usage，并按 session/prompt/model 去重；缓存是 input 子集。",
    "source.desc.kimi": "读取每个 agent wire 中可相加的 usage.record；忽略 context append 镜像。",
    "source.desc.pi": "读取 Pi assistant 与 compaction usage；排除重复的 subagent transcript artifacts。",
    "source.desc.hermes": "读取默认与命名 profile 的 session_model_usage；按 session/model 的最后活动日归档。",
    "source.desc.droid": "读取 Factory session *.settings.json 的 tokenUsage 累计快照并按 Codex 方式取增量；不用 inclusiveTokenUsage 与自身用量相加。无请求级时间戳，provider 记为 factory，请求数为下限。",
    "source.desc.fx": "读取会话 usage-v2.json 快照；cache/reasoning 是 input/output 子集。有 models[] 时按 provider/model 拆分，否则记 unknown。根 usage.jsonl 无 token 字段。billing 可能 incomplete，按下限处理。",
    "source.desc.copilot": "本地事件仅暴露输出 token；总量会显示为下限。",
    "source.desc.continue": "读取 Continue 本地 dev_data 中的 prompt/generated token 事件。",
    "source.desc.omp": "统计 OMP 主/子 agent 的真实 assistant usage；忽略 orchestration custom 摘要。",
    "source.desc.opencode": "支持 OpenCode JSON message storage；没有会话时保留为已检测数据源。",
    "source.desc.cursor": "检测到 Cursor，但本地 AI tracking 数据库不包含 token 用量。",
    "source.desc.aider": "检测到 Aider，但未发现结构化 token usage 日志。",
    "source.desc.fallback": "该 Harness 的本地用量数据。",
    "scan.meta": "{files} 个文件 · {updated} 个更新 · {ms} ms",
    "meta.updated": "更新于 {time} · {timezone}",
    "loading.refreshing": "正在检查变化的日志",
    "toast.scanFailed": "扫描失败：{message}",
    "toast.drilldownFailed": "读取下钻数据失败：{message}",
    "toast.keepOne":
      "至少保留一个 Harness。你也可以选择一个暂无数据的来源查看空状态。",
  },
  en: {
    "doc.title": "TokenScope · Personal Usage",
    "doc.description":
      "TokenScope — Personal usage hub for AI coding harnesses on this machine",
    "brand.subtitle": "Personal Usage",
    "brand.link.aria": "TokenScope personal usage overview",
    "nav.aria": "Views",
    "nav.overview": "Overview",
    "nav.rank": "Rank",
    "privacy.pill": "Local · No upload",
    "range.aria": "Statistics time range",
    "range.today": "Today",
    "range.7d": "7 days",
    "range.30d": "30 days",
    "range.90d": "90 days",
    "range.all": "All",
    "action.refresh": "Refresh",
    "lang.select.aria": "Language",
    "lang.zh": "中文",
    "lang.en": "English",
    "view.overview.aria": "Overview",
    "view.rank.aria": "Rank",
    "view.harness.aria": "Harness drill-down",
    "overview.heading": "Personal Usage",
    "status.indexing": "Building the local index…",
    "metric.token": "Token",
    "metric.input": "Input",
    "metric.output": "Output",
    "metric.cache": "Cache",
    "metric.requests": "Requests",
    "metric.input.note": "Incl. cache reads & writes",
    "metric.cache.read": "read",
    "panel.trend": "Daily Trend",
    "legend.aria": "Legend",
    "legend.input": "Input",
    "legend.output": "Output",
    "trend.chart.aria": "Daily token usage bar chart with independent input and output scales",
    "trend.empty": "No visible usage in this range yet.",
    "panel.composition": "Composition",
    "composition.aria": "Composition dimension",
    "composition.providers": "By Provider",
    "composition.models": "Model",
    "composition.harnesses": "Harness",
    "panel.activity.aria": "Usage activity",
    "panel.activity": "Activity",
    "activity.legend.less": "Less",
    "activity.legend.more": "More",
    "panel.harness": "Harness",
    "status.waitingScan": "Waiting to scan",
    "rank.heading": "Rank",
    "rank.panel": "Who's on top",
    "rank.aria": "Ranking dimension",
    "col.dimension": "Provider",
    "col.share": "Share",
    "col.usage": "Usage",
    "col.requests": "Requests",
    "col.model": "Model",
    "col.provider": "Provider",
    "drilldown.heading": "Drill-down",
    "drilldown.token.note": "Sum of visible input + output tokens",
    "drilldown.output.note": "Model-generated output",
    "drilldown.providers.panel": "Provider Composition",
    "drilldown.models.panel": "Models",
    "footer.privacy":
      "Usage metadata is read locally. Logs are never uploaded; message bodies are never read.",
    "loading.title": "Scanning local logs",
    "loading.note": "Only changed files are processed after the first index.",
    "title.overview": "TokenScope · Personal Usage",
    "title.rank": "TokenScope · Rank",
    "title.drilldown": "TokenScope · Drill-down",
    "status.ready": "Complete",
    "status.partial": "Partial",
    "status.empty": "No records",
    "status.unavailable": "Not measurable",
    "status.error": "Read failed",
    "status.absent": "Not present",
    "bound.atLeast": "at least",
    "bound.exact": "exact",
    "range.noHistory": "No history",
    "range.caption": "{from} — {to} · {count} sessions",
    "range.dates": "{from} — {to}",
    "sessions.count": "{count} sessions",
    "requests.count": "{count} requests",
    "tokens.count": "{count} tokens",
    "cache.note.exact": "Share of visible input tokens served by cache reads",
    "cache.note.partial":
      "Cache rate is still computed against visible input while input is incomplete",
    "cache.rate": "Cache rate {value}",
    "cache.rate.empty": "Cache rate —",
    "cache.read": "Cache read {value}",
    "cache.read.empty": "Cache read —",
    "activity.empty": "No activity data yet.",
    "activity.aria":
      "Token activity heatmap for the past 12 months: {days} days with usage, {tokens} in total",
    "activity.summary.none": "No visible usage in the past 12 months.",
    "activity.summary":
      "{active} active days in the past 12 months · longest streak {longest} days · current streak {current} days",
    "activity.tooltip.usage": "{day} · {tokens} · {requests}",
    "activity.tooltip.none": "{day} · No usage",
    "empty.composition": "No composition data yet.",
    "empty.rank": "No ranking data yet.",
    "empty.harnessDetail": "No Harness details yet.",
    "empty.providers": "No Provider data yet.",
    "empty.models": "No Model data yet.",
    "drilldown.link": "Open {name} drill-down",
    "drilldown.heading.name": "Drill-down · {name}",
    "rank.share.aria": "Share is {percent}% of the top row",
    "source.selected": "selected",
    "source.unselected": "not selected",
    "source.checkbox.aria": "{name}, {tokens}, {state}",
    "source.desc.codex": "Input, output, cached, and reasoning tokens; includes active and archived sessions.",
    "source.desc.claude": "Merges streamed records by message id to avoid double counting; provider may be inferred from the current config.",
    "source.desc.gemini": "Reads usage metadata from Gemini CLI sessions, when the local version stores it.",
    "source.desc.grok": "Reads turn_completed usage, deduplicated by session/prompt/model; cached tokens are a subset of input.",
    "source.desc.kimi": "Reads additive usage.record entries from each agent wire; ignores context-append mirrors.",
    "source.desc.pi": "Reads Pi assistant and compaction usage; excludes duplicated subagent transcript artifacts.",
    "source.desc.hermes": "Reads session_model_usage from default and named profiles; archived by each session/model's last active day.",
    "source.desc.droid": "Reads cumulative tokenUsage snapshots from Factory session *.settings.json and takes deltas the Codex way; inclusiveTokenUsage is not added on top. No per-request timestamps, provider is recorded as factory, and request count is a lower bound.",
    "source.desc.fx": "Reads session usage-v2.json snapshots; cache/reasoning are subsets of input/output. Split by provider/model when models[] is present, otherwise recorded as unknown. The root usage.jsonl has no token fields. Billing may be incomplete and is treated as a lower bound.",
    "source.desc.copilot": "Local events only expose output tokens; totals are shown as a lower bound.",
    "source.desc.continue": "Reads prompt/generated token events from Continue's local dev_data.",
    "source.desc.omp": "Counts real assistant usage from OMP main/sub agents; ignores orchestration custom summaries.",
    "source.desc.opencode": "Supports OpenCode JSON message storage; kept as a detected source when no sessions exist.",
    "source.desc.cursor": "Cursor detected, but its local AI tracking database contains no token usage.",
    "source.desc.aider": "Aider detected, but no structured token usage logs were found.",
    "source.desc.fallback": "Local usage data for this harness.",
    "scan.meta": "{files} files · {updated} updated · {ms} ms",
    "meta.updated": "Updated {time} · {timezone}",
    "loading.refreshing": "Checking for changed logs",
    "toast.scanFailed": "Scan failed: {message}",
    "toast.drilldownFailed": "Failed to load drill-down data: {message}",
    "toast.keepOne":
      "Keep at least one Harness. You can still select a source with no data to see its empty state.",
  },
};

const localeChangeHandlers = new Set();

export function normalizeLocale(value) {
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

export function getLocale() {
  return currentLocale;
}

export function t(key, params) {
  const table = dictionaries[currentLocale] || dictionaries[DEFAULT_LOCALE];
  let value;
  if (Object.hasOwn(table, key)) {
    value = table[key];
  } else if (Object.hasOwn(dictionaries[DEFAULT_LOCALE], key)) {
    value = dictionaries[DEFAULT_LOCALE][key];
  } else {
    return key;
  }
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

// Whether a key resolves to real copy (versus t() echoing the key back).
// Lets classic app.js pick per-source description keys without leaking raw
// keys into tooltips for harness ids the dictionaries do not know yet.
export function has(key) {
  const table = dictionaries[currentLocale] || dictionaries[DEFAULT_LOCALE];
  return (
    Object.hasOwn(table, key) || Object.hasOwn(dictionaries[DEFAULT_LOCALE], key)
  );
}

export function formatDay(day) {
  if (!day) return t("range.noHistory");
  return dateFormatter.format(new Date(`${day}T12:00:00`));
}

export function formatMonthLabel(date) {
  return monthFormatter.format(date);
}

export function formatDateTime(date) {
  return timeFormatter.format(date);
}

export function applyStaticBindings(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });
  root.querySelectorAll("[data-i18n-attrs]").forEach((node) => {
    node.dataset.i18nAttrs.split(",").forEach((entry) => {
      const separator = entry.indexOf(":");
      if (separator <= 0) return;
      const attribute = entry.slice(0, separator).trim();
      const key = entry.slice(separator + 1).trim();
      if (attribute && key) node.setAttribute(attribute, t(key));
    });
  });
}

function readStoredLocale() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? null : normalizeLocale(stored);
  } catch {
    return null;
  }
}

function persistLocale(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Persistence is best-effort; the in-memory locale still applies.
  }
}

function syncLocaleSelect() {
  const select = document.getElementById("localeSelect");
  if (!select) return;
  select.value = currentLocale;
}

function notifyLocaleChange(locale) {
  localeChangeHandlers.forEach((handler) => {
    handler(locale);
  });
  document.dispatchEvent(
    new CustomEvent(LOCALE_CHANGE_EVENT, { detail: { locale } }),
  );
}

export function onLocaleChange(handler) {
  localeChangeHandlers.add(handler);
  return () => localeChangeHandlers.delete(handler);
}

// Switch locale: persist, sync <html lang> and the dropdown, rebind all static
// chrome, then notify listeners (app.js re-renders the current view).
export function applyLocale(lang) {
  const next = normalizeLocale(lang);
  currentLocale = next;
  rebuildDateFormatters();
  if (typeof document !== "undefined") {
    persistLocale(next);
    document.documentElement.lang = HTML_LANGS[next];
    applyStaticBindings(document);
    syncLocaleSelect();
    notifyLocaleChange(next);
  }
  return currentLocale;
}

function wireLocaleSelect() {
  const select = document.getElementById("localeSelect");
  if (!select) return;
  select.addEventListener("change", (event) => {
    applyLocale(event.target.value);
  });
}

// Restore the persisted preference (default zh), bind static chrome, and wire
// the locale dropdown. Runs once at module evaluation; the DOM is already
// parsed because module scripts are deferred.
export function initI18n() {
  currentLocale = readStoredLocale() || DEFAULT_LOCALE;
  rebuildDateFormatters();
  document.documentElement.lang = HTML_LANGS[currentLocale];
  applyStaticBindings(document);
  wireLocaleSelect();
  syncLocaleSelect();
  return currentLocale;
}

if (typeof document !== "undefined") {
  initI18n();
}

if (typeof window !== "undefined") {
  // Bridge for classic app.js, which renders all dynamic strings through t().
  window.tokenscopeI18n = {
    getLocale,
    t,
    has,
    applyLocale,
    onLocaleChange,
    formatDay,
    formatMonthLabel,
    formatDateTime,
    formatCompact,
    formatFull,
    formatKnown,
    formatMetric,
    compactScale,
    formatAxisTick,
  };
}
