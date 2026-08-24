// Static-chrome i18n core for TokenScope (WADE-24).
//
// Owns the zh/en dictionaries for copy that lives in index.html, the
// topbar language toggle, localStorage persistence, and <html lang> sync.
// Dynamic JS-built strings (status labels, empty states, toasts, drill-down
// document.title) stay owned by their renderers; WADE-25 hooks in via
// getLocale()/t()/onLocaleChange().
//
// Loaded as a module script placed before app.js. Module scripts defer by
// default and keep document order with other deferred scripts, so the
// `window.tokenscopeI18n` bridge exists before app.js runs. The bridge is
// also exposed because app.js is a classic script and cannot import.

export const SUPPORTED_LOCALES = ["zh", "en"];
export const DEFAULT_LOCALE = "zh";
export const STORAGE_KEY = "tokenscope.locale";
export const LOCALE_CHANGE_EVENT = "tokenscope:localechange";

const HTML_LANGS = { zh: "zh-CN", en: "en" };

export const dictionaries = {
  zh: {
    "doc.title": "TokenScope · 个人用量",
    "doc.description": "TokenScope — 本机 AI coding harness 个人用量中心",
    "brand.subtitle": "个人用量",
    "brand.link.aria": "TokenScope 个人用量首页",
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
    "lang.toggle.aria": "切换语言",
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
    "trend.chart.aria": "每日 token 消耗柱状图",
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
  },
  en: {
    "doc.title": "TokenScope · Personal Usage",
    "doc.description":
      "TokenScope — Personal usage hub for AI coding harnesses on this machine",
    "brand.subtitle": "Personal Usage",
    "brand.link.aria": "TokenScope personal usage home",
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
    "lang.toggle.aria": "Switch language",
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
    "trend.chart.aria": "Daily token usage bar chart",
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
    "drilldown.models.panel": "Model Details",
    "footer.privacy":
      "Usage metadata is read locally. Logs are never uploaded; message bodies are never read.",
    "loading.title": "Scanning local logs",
    "loading.note": "Only changed files are processed after the first index.",
    "title.overview": "TokenScope · Personal Usage",
    "title.rank": "TokenScope · Rank",
    "title.drilldown": "TokenScope · Drill-down",
  },
};

let currentLocale = DEFAULT_LOCALE;
const localeChangeHandlers = new Set();

export function normalizeLocale(value) {
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

export function getLocale() {
  return currentLocale;
}

export function t(key) {
  const table = dictionaries[currentLocale] || dictionaries[DEFAULT_LOCALE];
  if (Object.hasOwn(table, key)) return table[key];
  if (Object.hasOwn(dictionaries[DEFAULT_LOCALE], key)) {
    return dictionaries[DEFAULT_LOCALE][key];
  }
  return key;
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

function syncLangToggle() {
  document.querySelectorAll("[data-lang-option]").forEach((option) => {
    option.classList.toggle("active", option.dataset.langOption === currentLocale);
  });
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

// Switch locale: persist, sync <html lang> and the toggle, rebind all static
// chrome, then notify listeners (app.js re-renders the current view).
export function applyLocale(lang) {
  const next = normalizeLocale(lang);
  currentLocale = next;
  if (typeof document !== "undefined") {
    persistLocale(next);
    document.documentElement.lang = HTML_LANGS[next];
    applyStaticBindings(document);
    syncLangToggle();
    notifyLocaleChange(next);
  }
  return currentLocale;
}

function wireLangToggle() {
  const button = document.getElementById("langToggle");
  if (!button) return;
  button.addEventListener("click", () => {
    applyLocale(currentLocale === "zh" ? "en" : "zh");
  });
}

// Restore the persisted preference (default zh), bind static chrome, and wire
// the toggle. Runs once at module evaluation; the DOM is already parsed
// because module scripts are deferred.
export function initI18n() {
  currentLocale = readStoredLocale() || DEFAULT_LOCALE;
  document.documentElement.lang = HTML_LANGS[currentLocale];
  applyStaticBindings(document);
  wireLangToggle();
  syncLangToggle();
  return currentLocale;
}

if (typeof document !== "undefined") {
  initI18n();
}

if (typeof window !== "undefined") {
  // Bridge for classic app.js and any future WADE-25 dynamic-string hooks.
  window.tokenscopeI18n = { getLocale, t, applyLocale, onLocaleChange };
}
