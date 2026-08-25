const state = {
  range: "30d",
  route: { view: "overview" },
  selectedHarnesses: new Set(),
  initialized: false,
  report: null,
  breakdown: "providers",
  loading: false,
  activityDays: new Map(),
  rankTab: "providers",
  rankExpanded: new Set(),
  drilldown: null,
};

const elements = {
  navLinks: document.querySelectorAll(".main-nav a"),
  viewOverview: document.querySelector("#view-overview"),
  viewRank: document.querySelector("#view-rank"),
  viewHarness: document.querySelector("#view-harness"),
  rankRangeCaption: document.querySelector("#rankRangeCaption"),
  rankDimensionLabel: document.querySelector("#rankDimensionLabel"),
  rankTabs: document.querySelectorAll("[data-rank-tab]"),
  rankList: document.querySelector("#rankList"),
  harnessRangeCaption: document.querySelector("#harnessRangeCaption"),
  harnessSubtitle: document.querySelector("#harnessSubtitle"),
  harnessHeading: document.querySelector("#harnessHeading"),
  harnessAccuracy: document.querySelector("#harnessAccuracy"),
  harnessTokens: document.querySelector("#harnessTokens"),
  harnessInputTokens: document.querySelector("#harnessInputTokens"),
  harnessCacheNote: document.querySelector("#harnessCacheNote"),
  harnessOutputTokens: document.querySelector("#harnessOutputTokens"),
  harnessProviders: document.querySelector("#harnessProviders"),
  harnessModels: document.querySelector("#harnessModels"),
  loadingLayer: document.querySelector("#loadingLayer"),
  loadingTitle: document.querySelector("#loadingTitle"),
  refreshButton: document.querySelector("#refreshButton"),
  totalTokens: document.querySelector("#totalTokens"),
  totalAccuracy: document.querySelector("#totalAccuracy"),
  inputTokens: document.querySelector("#inputTokens"),
  outputTokens: document.querySelector("#outputTokens"),
  requestCount: document.querySelector("#requestCount"),
  cacheRate: document.querySelector("#cacheRate"),
  cacheTokens: document.querySelector("#cacheTokens"),
  rangeCaption: document.querySelector("#rangeCaption"),
  trendChart: document.querySelector("#trendChart"),
  trendEmpty: document.querySelector("#trendEmpty"),
  activityGrid: document.querySelector("#activityGrid"),
  activityMonths: document.querySelector("#activityMonths"),
  activityTooltip: document.querySelector("#activityTooltip"),
  activitySummary: document.querySelector("#activitySummary"),
  activityWrap: document.querySelector(".activity-wrap"),
  activityScroll: document.querySelector(".activity-scroll"),
  breakdownButtons: document.querySelectorAll("[data-breakdown]"),
  breakdownList: document.querySelector("#breakdownList"),
  sourceGrid: document.querySelector("#sourceGrid"),
  scanMeta: document.querySelector("#scanMeta"),
  lastUpdated: document.querySelector("#lastUpdated"),
  toast: document.querySelector("#toast"),
};

const STATUS_LABEL_KEYS = {
  ready: "status.ready",
  partial: "status.partial",
  empty: "status.empty",
  unavailable: "status.unavailable",
  error: "status.error",
  absent: "status.absent",
};

// Fallbacks mirror public/format.js so overview metrics still render
// grouped full figures even if the i18n bridge fails to load.
const fallbackFullFormatter = new Intl.NumberFormat("en");

function harnessLogoSrc(id) {
  return window.tokenscopeHarness
    ? window.tokenscopeHarness.harnessLogoSrc(id)
    : null;
}

function harnessMarkFallback(id) {
  if (window.tokenscopeHarness) return window.tokenscopeHarness.harnessMarkFallback(id);
  const fallback = String(id || "").replace(/[^a-z0-9]/gi, "").slice(0, 2);
  return fallback ? fallback.toUpperCase() : "?";
}

function sortSourcesByRangeUsage(sources) {
  if (window.tokenscopeHarness) {
    return window.tokenscopeHarness.sortSourcesByRangeUsage(sources);
  }
  return [...sources];
}

function formatCompact(value) {
  return window.tokenscopeI18n
    ? window.tokenscopeI18n.formatCompact(value)
    : String(Number(value) || 0);
}

function formatFull(value) {
  return window.tokenscopeI18n
    ? window.tokenscopeI18n.formatFull(value)
    : fallbackFullFormatter.format(Math.round(Number(value) || 0));
}

function formatKnown(value, known) {
  if (window.tokenscopeI18n) return window.tokenscopeI18n.formatKnown(value, known);
  if (!known && !value) return "—";
  return `${known ? "" : "≥"}${formatFull(value)}`;
}

function formatMetric(value, known) {
  if (window.tokenscopeI18n) return window.tokenscopeI18n.formatMetric(value, known);
  if (!known && !value) return "—";
  return `${known ? "" : "≥"}${formatCompact(value)}`;
}

function compactScale(value) {
  return window.tokenscopeI18n
    ? window.tokenscopeI18n.compactScale(value)
    : { divisor: 1, suffix: "" };
}

function formatAxisTick(value, scale) {
  return window.tokenscopeI18n
    ? window.tokenscopeI18n.formatAxisTick(value, scale)
    : formatCompact(value);
}

function formatDay(day) {
  if (window.tokenscopeI18n) return window.tokenscopeI18n.formatDay(day);
  return day || t("range.noHistory");
}

function formatMonthLabel(date) {
  return window.tokenscopeI18n ? window.tokenscopeI18n.formatMonthLabel(date) : "";
}

function formatDateTime(date) {
  return window.tokenscopeI18n ? window.tokenscopeI18n.formatDateTime(date) : "";
}

function setText(element, value) {
  element.textContent = value;
}

function setMetricValue(element, value) {
  setText(element, value);
  element.classList.toggle("is-long", value.length >= 10);
  element.classList.toggle("is-longer", value.length >= 13);
}

function t(key, params) {
  return window.tokenscopeI18n ? window.tokenscopeI18n.t(key, params) : key;
}

function clear(element) {
  while (element.firstChild) element.firstChild.remove();
}

function showToast(message) {
  setText(elements.toast, message);
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 4200);
}

function setLoading(loading, firstLoad = false) {
  state.loading = loading;
  elements.refreshButton.disabled = loading;
  if (firstLoad) elements.loadingLayer.classList.toggle("hidden", !loading);
}

function renderSummary() {
  const { summary, range } = state.report;
  setMetricValue(elements.totalTokens, formatKnown(summary.knownTokens, summary.complete));
  setMetricValue(elements.inputTokens, formatKnown(summary.inputTokens, summary.inputKnown));
  setMetricValue(elements.outputTokens, formatKnown(summary.outputTokens, summary.outputKnown));
  elements.inputTokens.title = formatKnown(summary.inputTokens, summary.inputKnown);
  elements.outputTokens.title = formatKnown(summary.outputTokens, summary.outputKnown);
  setMetricValue(
    elements.requestCount,
    `${summary.complete ? "" : "≥"}${formatFull(summary.requests)}`,
  );
  setMetricValue(
    elements.cacheRate,
    summary.inputTokens ? `${(summary.cacheRate * 100).toFixed(1)}%` : "—",
  );
  setText(
    elements.cacheTokens,
    formatKnown(summary.cacheReadTokens, summary.inputKnown),
  );
  elements.cacheRate.title = t(
    summary.inputKnown ? "cache.note.exact" : "cache.note.partial",
  );
  setText(
    elements.rangeCaption,
    t("range.caption", {
      from: formatDay(range.from),
      to: formatDay(range.to),
      count: formatFull(summary.sessions),
    }),
  );
  setText(
    elements.totalAccuracy,
    t(summary.complete ? "bound.exact" : "bound.atLeast"),
  );
  elements.totalAccuracy.classList.toggle("partial", !summary.complete);
}

function drawTrend() {
  const canvas = elements.trendChart;
  const data = state.report?.daily || [];
  elements.trendEmpty.hidden = data.length > 0;
  canvas.hidden = data.length === 0;
  if (data.length === 0) return;

  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);

  const maximum = Math.max(...data.map((item) => item.knownTokens), 1);
  const axisScale = compactScale(maximum);

  context.font = "10px ui-sans-serif, system-ui";
  // Compact-scale ticks all share the series-maximum scale; size the left
  // gutter from the widest measured tick label so no tick can clip at the
  // chart edge, whatever the platform font metrics.
  const tickLabels = [];
  for (let index = 0; index <= 4; index += 1) {
    tickLabels.push(formatAxisTick(maximum * (1 - index / 4), axisScale));
  }
  const widestTick = Math.ceil(
    Math.max(...tickLabels.map((label) => context.measureText(label).width)),
  );
  const padding = {
    top: 10,
    right: 8,
    bottom: 31,
    left: Math.max(47, widestTick + 10),
  };
  const chartWidth = bounds.width - padding.left - padding.right;
  const chartHeight = bounds.height - padding.top - padding.bottom;

  context.textBaseline = "middle";
  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (chartHeight / 4) * index;
    context.strokeStyle = "rgba(255, 255, 255, 0.07)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding.left, y + 0.5);
    context.lineTo(bounds.width - padding.right, y + 0.5);
    context.stroke();
    context.fillStyle = "#8f988f";
    context.textAlign = "right";
    context.fillText(tickLabels[index], padding.left - 8, y);
  }

  const step = chartWidth / data.length;
  const barWidth = Math.max(1.5, Math.min(18, step * 0.62));
  data.forEach((item, index) => {
    const x = padding.left + step * index + (step - barWidth) / 2;
    const inputHeight = (item.inputTokens / maximum) * chartHeight;
    const outputHeight = (item.outputTokens / maximum) * chartHeight;
    const bottom = padding.top + chartHeight;
    context.fillStyle = "#c9f36b";
    context.fillRect(x, bottom - inputHeight, barWidth, inputHeight);
    context.fillStyle = "#ff7658";
    context.fillRect(x, bottom - inputHeight - outputHeight, barWidth, outputHeight);
  });

  const labelCount = Math.min(5, data.length);
  const indices = new Set();
  for (let index = 0; index < labelCount; index += 1) {
    indices.add(Math.round((index / Math.max(1, labelCount - 1)) * (data.length - 1)));
  }
  context.fillStyle = "#8f988f";
  context.textBaseline = "top";
  for (const index of indices) {
    const x = padding.left + step * index + step / 2;
    context.textAlign = index === 0 ? "left" : index === data.length - 1 ? "right" : "center";
    context.fillText(formatDay(data[index].day), x, padding.top + chartHeight + 10);
  }
}

function activityLevel(value, max) {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil(Math.sqrt(value / max) * 4)));
}

function renderActivity() {
  const activity = state.report?.activity;
  clear(elements.activityGrid);
  clear(elements.activityMonths);
  hideActivityTooltip();
  state.activityDays = new Map();
  if (!activity) {
    setText(elements.activitySummary, t("activity.empty"));
    return;
  }

  for (const day of activity.days) {
    const cell = document.createElement("i");
    cell.className = `activity-cell level-${activityLevel(day.knownTokens, activity.max)}`;
    if (day.future) cell.classList.add("future");
    cell.dataset.day = day.day;
    elements.activityGrid.append(cell);
    state.activityDays.set(day.day, day);
  }

  const cells = elements.activityGrid.children;
  let lastMonth = -1;
  for (let column = 0; column < activity.weeks; column += 1) {
    const monday = new Date(`${activity.days[column * 7].day}T12:00:00`);
    const month = monday.getMonth();
    if (month === lastMonth || monday.getDate() > 7) continue;
    lastMonth = month;
    const label = document.createElement("span");
    label.textContent = formatMonthLabel(monday);
    label.dataset.column = String(column);
    elements.activityMonths.append(label);
  }
  positionActivityMonthLabels();

  const prefix = activity.totalKnown ? "" : "≥";
  elements.activityGrid.setAttribute(
    "role",
    "img",
  );
  elements.activityGrid.setAttribute(
    "aria-label",
    t("activity.aria", {
      days: activity.activeDays,
      tokens: t("tokens.count", {
        count: `${prefix}${formatFull(activity.totalTokens)}`,
      }),
    }),
  );
  setText(
    elements.activitySummary,
    activity.activeDays === 0
      ? t("activity.summary.none")
      : t("activity.summary", {
          active: activity.activeDays,
          longest: activity.longestStreak,
          current: activity.currentStreak,
        }),
  );
}

function positionActivityMonthLabels() {
  const cells = elements.activityGrid.children;
  for (const label of elements.activityMonths.children) {
    const column = Number(label.dataset.column);
    const anchor = cells[column * 7];
    if (anchor) label.style.left = `${anchor.offsetLeft}px`;
  }
}

function hideActivityTooltip() {
  elements.activityTooltip.hidden = true;
}

function showActivityTooltip(cell) {
  const day = state.activityDays.get(cell.dataset.day);
  if (!day || day.future) {
    hideActivityTooltip();
    return;
  }
  const tooltip = elements.activityTooltip;
  setText(
    tooltip,
    day.knownTokens > 0
      ? t("activity.tooltip.usage", {
          day: formatDay(day.day),
          tokens: t("tokens.count", {
            count: `${day.complete ? "" : "≥"}${formatFull(day.knownTokens)}`,
          }),
          requests: t("requests.count", { count: formatFull(day.requests) }),
        })
      : t("activity.tooltip.none", { day: formatDay(day.day) }),
  );
  tooltip.hidden = false;

  const wrapRect = elements.activityWrap.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const halfWidth = tooltip.offsetWidth / 2;
  const rawLeft = cellRect.left - wrapRect.left + cellRect.width / 2;
  const left = Math.min(
    Math.max(rawLeft, halfWidth + 4),
    Math.max(halfWidth + 4, wrapRect.width - halfWidth - 4),
  );
  const above = cellRect.top - wrapRect.top > tooltip.offsetHeight + 14;
  tooltip.classList.toggle("below", !above);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${
    (above ? cellRect.top - wrapRect.top - 8 : cellRect.bottom - wrapRect.top + 8)
  }px`;
}

function sourceNameMap() {
  return new Map((state.report?.sources || []).map((source) => [source.id, source.name]));
}

function harnessHref(name) {
  return `#/harness/${encodeURIComponent(name)}`;
}

function renderBreakdown() {
  clear(elements.breakdownList);
  const items = state.report.breakdowns[state.breakdown] || [];
  const visible = items.slice(0, 7);
  const maximum = Math.max(...visible.map((item) => item.knownTokens), 1);
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = t("empty.composition");
    elements.breakdownList.append(empty);
    return;
  }

  const clickable = state.breakdown === "harnesses";
  const harnessNames = clickable ? sourceNameMap() : null;

  visible.forEach((item, index) => {
    const row = document.createElement(clickable ? "a" : "div");
    row.className = `breakdown-row palette-${index % 7}`;
    const displayName = clickable ? harnessNames.get(item.name) || item.name : item.name;
    if (clickable) {
      row.classList.add("breakdown-row-link");
      row.href = harnessHref(item.name);
      row.title = t("drilldown.link", { name: displayName });
    }

    const name = document.createElement("div");
    name.className = "breakdown-name";
    const swatch = document.createElement("span");
    swatch.className = "breakdown-swatch";
    const label = document.createElement("span");
    label.textContent = displayName;
    label.title = state.breakdown === "models" ? `${item.provider} / ${item.name}` : displayName;
    name.append(swatch, label);

    const value = document.createElement("span");
    value.className = "breakdown-value";
    value.textContent = `${item.complete ? "" : "≥"}${formatCompact(item.knownTokens)}`;

    const progress = document.createElement("progress");
    progress.max = maximum;
    progress.value = item.knownTokens;
    progress.setAttribute(
      "aria-label",
      `${displayName} ${item.complete ? "" : `${t("bound.atLeast")} `}${t("tokens.count", { count: formatFull(item.knownTokens) })}`,
    );
    row.append(name, value, progress);
    elements.breakdownList.append(row);
  });
}

const RANK_DIMENSION_KEYS = {
  providers: "col.provider",
  models: "composition.models",
  harnesses: "composition.harnesses",
};

function shareWidth(value, maximum) {
  const percent = Math.round((value / maximum) * 100);
  return `${Math.max(value > 0 ? 1 : 0, percent)}%`;
}

function appendUsageCells(target, row) {
  const usage = document.createElement("span");
  usage.className = "rank-usage";
  usage.textContent = formatMetric(row.knownTokens, row.complete);
  usage.title = t("tokens.count", {
    count: formatKnown(row.knownTokens, row.complete),
  });

  const requests = document.createElement("span");
  requests.className = "rank-requests";
  requests.textContent = `${row.complete ? "" : "≥"}${formatFull(row.requests)}`;
  requests.title = t("requests.count", {
    count: formatKnown(row.requests, row.complete),
  });

  target.append(usage, requests);
}

function appendRankCells(target, { position, name, sub, title, row, maximum, expandable }) {
  const rank = document.createElement("span");
  rank.className = "rank-position";
  rank.textContent = String(position + 1);

  const nameBlock = document.createElement("span");
  nameBlock.className = "rank-name";
  const label = document.createElement("strong");
  label.textContent = name;
  if (title) label.title = title;
  nameBlock.append(label);
  if (expandable) {
    const caret = document.createElement("i");
    caret.className = "rank-caret";
    caret.setAttribute("aria-hidden", "true");
    nameBlock.append(caret);
  }
  if (sub) {
    const detail = document.createElement("small");
    detail.textContent = sub;
    nameBlock.append(detail);
  }

  const bar = document.createElement("span");
  bar.className = "rank-bar";
  bar.setAttribute("role", "img");
  bar.setAttribute(
    "aria-label",
    t("rank.share.aria", {
      percent: Math.max(0, Math.round((row.knownTokens / maximum) * 100)),
    }),
  );
  const fill = document.createElement("i");
  fill.style.width = shareWidth(row.knownTokens, maximum);
  bar.append(fill);

  target.append(rank, nameBlock, bar);
  appendUsageCells(target, row);
}

function appendModelHarnessDetail(container, model, harnessNames) {
  const parts = (state.report.groups || []).filter(
    (group) => group.model === model.name && group.provider === model.provider,
  );
  const maximum = Math.max(...parts.map((part) => part.knownTokens), 1);
  if (parts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "rank-detail-empty";
    empty.textContent = t("empty.harnessDetail");
    container.append(empty);
    return;
  }
  parts.forEach((part) => {
    const line = document.createElement("div");
    line.className = "rank-detail-row";

    const name = document.createElement("span");
    name.className = "rank-detail-name";
    name.textContent = harnessNames.get(part.harness) || part.harness;
    name.title = part.harness;

    const bar = document.createElement("span");
    bar.className = "rank-bar rank-bar-detail";
    bar.setAttribute("aria-hidden", "true");
    const fill = document.createElement("i");
    fill.style.width = shareWidth(part.knownTokens, maximum);
    bar.append(fill);

    line.append(name, bar);
    appendUsageCells(line, part);
    container.append(line);
  });
}

function renderRank() {
  if (!state.report) return;
  const { range, summary } = state.report;
  setText(
    elements.rankRangeCaption,
    t("range.caption", {
      from: formatDay(range.from),
      to: formatDay(range.to),
      count: formatFull(summary.sessions),
    }),
  );
  setText(
    elements.rankDimensionLabel,
    t(RANK_DIMENSION_KEYS[state.rankTab] || "col.provider"),
  );

  clear(elements.rankList);
  const rows = state.report.breakdowns[state.rankTab] || [];
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = t("empty.rank");
    elements.rankList.append(empty);
    return;
  }

  const maximum = Math.max(...rows.map((row) => row.knownTokens), 1);
  const harnessNames = sourceNameMap();

  rows.forEach((row, index) => {
    const rowFrame = document.createElement("div");
    rowFrame.className = "rank-row";

    if (state.rankTab === "models") {
      const key = `${row.provider}\u0000${row.name}`;
      const detailId = `rank-detail-${state.rankTab}-${index}`;
      const expanded = state.rankExpanded.has(key);
      rowFrame.classList.add("rank-row-expandable");
      rowFrame.classList.toggle("expanded", expanded);

      const main = document.createElement("button");
      main.type = "button";
      main.className = "rank-row-main";
      main.dataset.rankToggle = key;
      main.setAttribute("aria-expanded", String(expanded));
      main.setAttribute("aria-controls", detailId);
      appendRankCells(main, {
        position: index,
        name: row.name,
        sub: row.provider,
        title: `${row.provider} / ${row.name}`,
        row,
        maximum,
        expandable: true,
      });

      const detail = document.createElement("div");
      detail.className = "rank-detail";
      detail.id = detailId;
      detail.hidden = !expanded;
      appendModelHarnessDetail(detail, row, harnessNames);

      rowFrame.append(main, detail);
    } else if (state.rankTab === "harnesses") {
      const main = document.createElement("a");
      main.className = "rank-row-main rank-row-link";
      main.href = harnessHref(row.name);
      main.title = t("drilldown.link", {
        name: harnessNames.get(row.name) || row.name,
      });
      appendRankCells(main, {
        position: index,
        name: harnessNames.get(row.name) || row.name,
        title: row.name,
        row,
        maximum,
        expandable: false,
      });
      rowFrame.append(main);
    } else {
      const main = document.createElement("div");
      main.className = "rank-row-main rank-row-static";
      appendRankCells(main, {
        position: index,
        name: row.name,
        row,
        maximum,
        expandable: false,
      });
      rowFrame.append(main);
    }

    elements.rankList.append(rowFrame);
  });
}

function coverageTooltip(source, statusText) {
  return [source.name, statusText, sourceTooltipDescription(source), source.displayPath]
    .filter(Boolean)
    .join("\n");
}

// Tooltip descriptions resolve through the i18n dictionaries, never the raw
// backend description field (zh adapter metadata). Known harness ids get
// source.desc.<id>; ids the dictionaries have not met yet fall back to a
// generic localized line instead of leaking Chinese into EN hovers.
function sourceTooltipDescription(source) {
  const key = `source.desc.${source.id}`;
  if (window.tokenscopeI18n && window.tokenscopeI18n.has(key)) return t(key);
  return t("source.desc.fallback");
}

function renderSources() {
  clear(elements.sourceGrid);
  sortSourcesByRangeUsage(state.report.sources).forEach((source) => {
    const selected = state.selectedHarnesses.has(source.id);
    const statusKey = STATUS_LABEL_KEYS[source.status];
    const statusText = statusKey ? t(statusKey) : source.status;
    const tokenText = source.rangeKnownTokens
      ? `${source.rangeComplete ? "" : "≥"}${formatCompact(source.rangeKnownTokens)}`
      : "—";
    const tooltip = coverageTooltip(source, statusText);
    const item = document.createElement("label");
    item.className = `harness-item harness-card source-${source.id}`;
    item.dataset.harnessId = source.id;
    item.classList.toggle("selected", selected);
    item.title = tooltip;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "harness-card-toggle";
    checkbox.checked = selected;
    checkbox.setAttribute(
      "aria-label",
      t("source.checkbox.aria", {
        name: source.name,
        tokens: t("tokens.count", { count: tokenText }),
        state: t(selected ? "source.selected" : "source.unselected"),
      }),
    );
    checkbox.title = tooltip;
    checkbox.addEventListener("change", (event) => {
      event.preventDefault();
      toggleSource(source.id);
    });

    const mark = document.createElement("span");
    mark.className = "harness-mark";
    mark.dataset.harnessId = source.id;
    mark.setAttribute("aria-hidden", "true");
    const logoSrc = harnessLogoSrc(source.id);
    if (logoSrc) {
      mark.classList.add("harness-mark-logo");
      mark.style.setProperty("--harness-logo", `url("${logoSrc}")`);
    } else {
      mark.textContent = harnessMarkFallback(source.id);
    }

    const body = document.createElement("span");
    body.className = "harness-card-body";

    const name = document.createElement("span");
    name.className = "harness-name";
    name.textContent = source.name;

    const usage = document.createElement("span");
    usage.className = "harness-usage";
    usage.textContent = tokenText;
    usage.setAttribute("aria-hidden", "true");

    body.append(name, usage);
    item.append(checkbox, mark, body);
    elements.sourceGrid.append(item);
  });
}

function renderMeta() {
  const { cache, generatedAt, timezone } = state.report;
  setText(
    elements.scanMeta,
    t("scan.meta", {
      files: cache.indexedFiles,
      updated: cache.parsedFiles,
      ms: cache.durationMs,
    }),
  );
  setText(
    elements.lastUpdated,
    t("meta.updated", {
      time: formatDateTime(new Date(generatedAt)),
      timezone,
    }),
  );
}

function render() {
  renderSummary();
  drawTrend();
  renderActivity();
  renderBreakdown();
  renderSources();
  renderMeta();
}

function renderHarness() {
  const report = state.drilldown;
  if (!report || state.route.view !== "harness") return;
  const { range, summary } = report;

  const displayName = harnessDisplayName(state.route.name) || state.route.name;
  setText(
    elements.harnessHeading,
    t("drilldown.heading.name", { name: displayName }),
  );
  document.title = `${t("title.drilldown")} · ${displayName}`;

  setText(
    elements.harnessRangeCaption,
    t("range.dates", {
      from: formatDay(range.from),
      to: formatDay(range.to),
    }),
  );
  setText(
    elements.harnessSubtitle,
    [
      t("sessions.count", {
        count: `${summary.complete ? "" : "≥"}${formatFull(summary.sessions)}`,
      }),
      t("requests.count", {
        count: `${summary.complete ? "" : "≥"}${formatFull(summary.requests)}`,
      }),
      summary.inputTokens
        ? t("cache.rate", { value: `${(summary.cacheRate * 100).toFixed(1)}%` })
        : t("cache.rate.empty"),
    ].join(" · "),
  );

  setText(
    elements.harnessAccuracy,
    t(summary.complete ? "bound.exact" : "bound.atLeast"),
  );
  elements.harnessAccuracy.classList.toggle("partial", !summary.complete);
  setMetricValue(
    elements.harnessTokens,
    formatKnown(summary.knownTokens, summary.complete),
  );
  setMetricValue(elements.harnessInputTokens, formatKnown(summary.inputTokens, summary.inputKnown));
  setMetricValue(elements.harnessOutputTokens, formatKnown(summary.outputTokens, summary.outputKnown));
  elements.harnessInputTokens.title = formatKnown(summary.inputTokens, summary.inputKnown);
  elements.harnessOutputTokens.title = formatKnown(summary.outputTokens, summary.outputKnown);
  setText(
    elements.harnessCacheNote,
    summary.inputTokens
      ? t("cache.read", {
          value: formatMetric(summary.cacheReadTokens, summary.inputKnown),
        })
      : t("cache.read.empty"),
  );

  clear(elements.harnessProviders);
  const providers = report.breakdowns.providers || [];
  if (providers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = t("empty.providers");
    elements.harnessProviders.append(empty);
  } else {
    const maximum = Math.max(...providers.map((item) => item.knownTokens), 1);
    providers.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = `breakdown-row palette-${index % 7}`;

      const name = document.createElement("div");
      name.className = "breakdown-name";
      const swatch = document.createElement("span");
      swatch.className = "breakdown-swatch";
      const label = document.createElement("span");
      label.textContent = item.name;
      name.append(swatch, label);

      const value = document.createElement("span");
      value.className = "breakdown-value";
      value.textContent = `${item.complete ? "" : "≥"}${formatCompact(item.knownTokens)}`;

      const progress = document.createElement("progress");
      progress.max = maximum;
      progress.value = item.knownTokens;
      progress.setAttribute(
        "aria-label",
        `${item.name} ${item.complete ? "" : `${t("bound.atLeast")} `}${t("tokens.count", { count: formatFull(item.knownTokens) })}`,
      );
      row.append(name, value, progress);
      elements.harnessProviders.append(row);
    });
  }

  clear(elements.harnessModels);
  const models = report.breakdowns.models || [];
  if (models.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = t("empty.models");
    elements.harnessModels.append(empty);
    return;
  }
  models.forEach((row) => {
    const frame = document.createElement("div");
    frame.className = "rank-row";

    const main = document.createElement("div");
    main.className = "rank-row-main rank-row-static harness-model-row";

    const name = document.createElement("span");
    name.className = "harness-model-name";
    name.textContent = row.name;
    name.title = `${row.provider} / ${row.name}`;

    const provider = document.createElement("span");
    provider.className = "harness-model-provider";
    provider.textContent = row.provider;

    main.append(
      name,
      provider,
      ...(() => {
        const usage = document.createElement("span");
        usage.className = "rank-usage";
        usage.textContent = formatMetric(row.knownTokens, row.complete);
        usage.title = t("tokens.count", {
          count: formatKnown(row.knownTokens, row.complete),
        });
        const requests = document.createElement("span");
        requests.className = "rank-requests";
        requests.textContent = `${row.complete ? "" : "≥"}${formatFull(row.requests)}`;
        requests.title = t("requests.count", {
          count: formatKnown(row.requests, row.complete),
        });
        return [usage, requests];
      })(),
    );
    frame.append(main);
    elements.harnessModels.append(frame);
  });
}

async function loadDrilldown() {
  const name = state.route.view === "harness" ? state.route.name : null;
  if (!name) return;
  const parameters = new URLSearchParams({ range: state.range, harness: name });
  try {
    const response = await fetch(`/api/usage?${parameters}`);
    const value = await response.json();
    if (!response.ok) throw new Error(value.detail || value.error || t("status.error"));
    state.drilldown = value;
  } catch (error) {
    showToast(t("toast.drilldownFailed", { message: error.message }));
    return;
  }
  renderHarness();
}

function renderView() {
  if (!state.report) return;
  // Footer timestamp is shared across views; keep it in the current locale
  // even when Rank or drill-down skip the Overview render path.
  renderMeta();
  if (state.route.view === "overview") {
    render();
    return;
  }
  if (state.route.view === "rank") {
    renderRank();
    return;
  }
  renderHarness();
}

function parseHash(hash) {
  const raw = hash.replace(/^#/, "");
  const path = (raw.length > 0 ? raw : "/").replace(/\/+$/, "") || "/";
  if (path === "/") return { view: "overview" };
  if (path === "/rank") return { view: "rank" };
  const harness = path.match(/^\/harness(?:\/(.*))?$/);
  if (harness) {
    let name = "";
    try {
      name = decodeURIComponent(harness[1] || "").trim();
    } catch {
      return { redirect: "#/rank" };
    }
    if (name) return { view: "harness", name };
    return { redirect: "#/rank" };
  }
  return { redirect: "#/" };
}

function knownHarness(name) {
  const sources = state.report?.sources || [];
  return sources.some(
    (source) => source.id === name || source.name === name,
  );
}

function harnessDisplayName(name) {
  const sources = state.report?.sources || [];
  const source = sources.find((item) => item.id === name || item.name === name);
  return source?.name || "";
}

const VIEW_ELEMENTS = {
  overview: "viewOverview",
  rank: "viewRank",
  harness: "viewHarness",
};

function applyDocumentTitle() {
  if (state.route.view === "harness") {
    const name = harnessDisplayName(state.route.name) || state.route.name;
    document.title = `${t("title.drilldown")} · ${name}`;
  } else if (state.route.view === "rank") {
    document.title = t("title.rank");
  } else {
    document.title = t("title.overview");
  }
}

function applyRoute() {
  const route = parseHash(location.hash);
  if (route.redirect) {
    location.replace(route.redirect);
    return;
  }
  if (
    route.view === "harness" &&
    state.report &&
    !knownHarness(route.name)
  ) {
    location.replace("#/rank");
    return;
  }
  state.route = route;

  for (const [view, key] of Object.entries(VIEW_ELEMENTS)) {
    elements[key].hidden = route.view !== view;
  }

  const activeNav = route.view === "harness" ? "rank" : route.view;
  elements.navLinks.forEach((link) => {
    const active = link.dataset.nav === activeNav;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  if (route.view === "harness") {
    const name = state.report
      ? harnessDisplayName(route.name) || route.name
      : route.name;
    setText(elements.harnessHeading, t("drilldown.heading.name", { name }));
    loadDrilldown();
  }
  applyDocumentTitle();

  renderView();
}

async function loadReport({ refresh = false } = {}) {
  if (state.loading) return;
  const firstLoad = !state.initialized;
  setLoading(true, firstLoad);
  if (refresh) setText(elements.loadingTitle, t("loading.refreshing"));

  const parameters = new URLSearchParams({ range: state.range });
  if (refresh) parameters.set("refresh", "1");
  if (state.initialized && state.selectedHarnesses.size > 0) {
    parameters.set("harnesses", [...state.selectedHarnesses].join(","));
  }

  try {
    const response = await fetch(`/api/usage?${parameters}`);
    const value = await response.json();
    if (!response.ok) throw new Error(value.detail || value.error || t("status.error"));
    state.report = value;
    if (!state.initialized) {
      state.selectedHarnesses = new Set(
        value.sources.filter((source) => source.detected).map((source) => source.id),
      );
      state.initialized = true;
    }
    if (state.route.view === "harness" && !knownHarness(state.route.name)) {
      location.replace("#/rank");
      return;
    }
  } catch (error) {
    showToast(t("toast.scanFailed", { message: error.message }));
  } finally {
    setLoading(false, firstLoad);
    setText(elements.loadingTitle, t("loading.title"));
  }
  if (state.report) renderView();
}

async function toggleSource(sourceId) {
  if (state.loading) return;
  if (state.selectedHarnesses.has(sourceId)) {
    if (state.selectedHarnesses.size === 1) {
      showToast(t("toast.keepOne"));
      renderSources();
      return;
    }
    state.selectedHarnesses.delete(sourceId);
  } else {
    state.selectedHarnesses.add(sourceId);
  }
  await loadReport();
}

document.querySelectorAll("[data-range]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (state.loading || state.range === button.dataset.range) return;
    state.range = button.dataset.range;
    document.querySelectorAll("[data-range]").forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    await loadReport();
    if (state.route.view === "harness") await loadDrilldown();
  });
});

elements.rankTabs.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.rankTab === button.dataset.rankTab) return;
    state.rankTab = button.dataset.rankTab;
    elements.rankTabs.forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderRank();
  });
});
elements.rankList.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-rank-toggle]");
  if (!toggle) return;
  const key = toggle.dataset.rankToggle;
  const detail = document.getElementById(toggle.getAttribute("aria-controls"));
  const expanded = state.rankExpanded.has(key);
  if (expanded) state.rankExpanded.delete(key);
  else state.rankExpanded.add(key);
  toggle.setAttribute("aria-expanded", String(!expanded));
  if (detail) detail.hidden = expanded;
  toggle.closest(".rank-row")?.classList.toggle("expanded", !expanded);
});

elements.refreshButton.addEventListener("click", () => loadReport({ refresh: true }));
elements.activityGrid.addEventListener("mouseover", (event) => {
  if (event.target.classList?.contains("activity-cell")) {
    showActivityTooltip(event.target);
  }
});
elements.activityGrid.addEventListener("mouseleave", hideActivityTooltip);
elements.activityScroll.addEventListener("scroll", hideActivityTooltip, { passive: true });
elements.breakdownButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.breakdown === button.dataset.breakdown) return;
    state.breakdown = button.dataset.breakdown;
    elements.breakdownButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderBreakdown();
  });
});

if ("ResizeObserver" in window) {
  const observer = new ResizeObserver(() => {
    drawTrend();
    positionActivityMonthLabels();
  });
  observer.observe(elements.trendChart.parentElement);
  observer.observe(elements.activityGrid);
} else {
  window.addEventListener("resize", () => {
    drawTrend();
    positionActivityMonthLabels();
  });
}

window.addEventListener("hashchange", applyRoute);
document.addEventListener("tokenscope:localechange", () => {
  applyDocumentTitle();
  if (!state.report) return;
  // Refresh every view's dynamic copy, including hidden ones, so leftover
  // zh/EN does not linger in titles, aria-labels, or the shared footer.
  render();
  renderRank();
  if (state.route.view === "harness" && state.drilldown) renderHarness();
});
applyRoute();
loadReport();
