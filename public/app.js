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

const compactFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const fullFormatter = new Intl.NumberFormat("zh-CN");
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
});
const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const statusLabels = {
  ready: "完整",
  partial: "部分",
  empty: "暂无记录",
  unavailable: "不可统计",
  error: "读取失败",
  absent: "未安装",
};

function formatCompact(value) {
  return compactFormatter.format(Number(value) || 0);
}

function formatFull(value) {
  return fullFormatter.format(Math.round(Number(value) || 0));
}

function formatKnown(value, known) {
  if (!known && !value) return "—";
  return `${known ? "" : "≥"}${formatFull(value)}`;
}

function formatMetric(value, known) {
  if (!known && !value) return "—";
  return `${known ? "" : "≥"}${formatCompact(value)}`;
}

function formatDay(day) {
  if (!day) return "无历史数据";
  return dateFormatter.format(new Date(`${day}T12:00:00`));
}

function setText(element, value) {
  element.textContent = value;
}

function t(key) {
  return window.tokenscopeI18n ? window.tokenscopeI18n.t(key) : key;
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
  const prefix = summary.complete ? "" : "≥";
  setText(elements.totalTokens, `${prefix}${formatCompact(summary.knownTokens)}`);
  setText(elements.inputTokens, formatMetric(summary.inputTokens, summary.inputKnown));
  setText(elements.outputTokens, formatMetric(summary.outputTokens, summary.outputKnown));
  elements.inputTokens.title = formatKnown(summary.inputTokens, summary.inputKnown);
  elements.outputTokens.title = formatKnown(summary.outputTokens, summary.outputKnown);
  setText(
    elements.requestCount,
    `${summary.complete ? "" : "≥"}${formatFull(summary.requests)}`,
  );
  setText(
    elements.cacheRate,
    summary.inputTokens ? `${(summary.cacheRate * 100).toFixed(1)}%` : "—",
  );
  setText(
    elements.cacheTokens,
    formatMetric(summary.cacheReadTokens, summary.inputKnown),
  );
  elements.cacheRate.title = summary.inputKnown
    ? "可见输入 token 中的缓存读取占比"
    : "输入不完整时仍按可见输入计算缓存率";
  setText(
    elements.rangeCaption,
    `${formatDay(range.from)} — ${formatDay(range.to)} · ${formatFull(summary.sessions)} 个会话`,
  );
  setText(elements.totalAccuracy, summary.complete ? "精确" : "至少");
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

  const padding = { top: 10, right: 8, bottom: 31, left: 47 };
  const chartWidth = bounds.width - padding.left - padding.right;
  const chartHeight = bounds.height - padding.top - padding.bottom;
  const maximum = Math.max(...data.map((item) => item.knownTokens), 1);

  context.font = "10px ui-sans-serif, system-ui";
  context.textBaseline = "middle";
  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (chartHeight / 4) * index;
    const value = maximum * (1 - index / 4);
    context.strokeStyle = "rgba(255, 255, 255, 0.07)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding.left, y + 0.5);
    context.lineTo(bounds.width - padding.right, y + 0.5);
    context.stroke();
    context.fillStyle = "#8f988f";
    context.textAlign = "right";
    context.fillText(formatCompact(value), padding.left - 8, y);
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
    setText(elements.activitySummary, "暂无活动数据。");
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
    label.textContent = monthFormatter.format(monday);
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
    `过去 12 个月 token 活动热力图：${activity.activeDays} 天有用量，合计 ${prefix}${formatFull(activity.totalTokens)} token`,
  );
  setText(
    elements.activitySummary,
    activity.activeDays === 0
      ? "过去 12 个月没有可见用量。"
      : `过去 12 个月 ${activity.activeDays} 天活跃 · 最长连续 ${activity.longestStreak} 天 · 当前连续 ${activity.currentStreak} 天`,
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
      ? `${formatDay(day.day)} · ${day.complete ? "" : "≥"}${formatFull(day.knownTokens)} token · ${formatFull(day.requests)} 次请求`
      : `${formatDay(day.day)} · 无用量`,
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
    empty.textContent = "暂无构成数据。";
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
      row.title = `查看 ${displayName} 下钻`;
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
      `${displayName} ${item.complete ? "" : "至少 "}${formatFull(item.knownTokens)} token`,
    );
    row.append(name, value, progress);
    elements.breakdownList.append(row);
  });
}

const RANK_DIMENSIONS = {
  providers: "Provider",
  models: "Model",
  harnesses: "Harness",
};

function shareWidth(value, maximum) {
  const percent = Math.round((value / maximum) * 100);
  return `${Math.max(value > 0 ? 1 : 0, percent)}%`;
}

function appendUsageCells(target, row) {
  const usage = document.createElement("span");
  usage.className = "rank-usage";
  usage.textContent = formatMetric(row.knownTokens, row.complete);
  usage.title = `${formatKnown(row.knownTokens, row.complete)} token`;

  const requests = document.createElement("span");
  requests.className = "rank-requests";
  requests.textContent = `${row.complete ? "" : "≥"}${formatFull(row.requests)}`;
  requests.title = `${formatKnown(row.requests, row.complete)} 次请求`;

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
    `份额为榜首行的 ${Math.max(0, Math.round((row.knownTokens / maximum) * 100))}%`,
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
    empty.textContent = "暂无 Harness 明细。";
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
    `${formatDay(range.from)} — ${formatDay(range.to)} · ${formatFull(summary.sessions)} 个会话`,
  );
  setText(elements.rankDimensionLabel, RANK_DIMENSIONS[state.rankTab] || "Provider");

  clear(elements.rankList);
  const rows = state.report.breakdowns[state.rankTab] || [];
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = "暂无排行数据。";
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
      main.title = `查看 ${harnessNames.get(row.name) || row.name} 下钻`;
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
  return [source.name, statusText, source.description, source.displayPath]
    .filter(Boolean)
    .join("\n");
}

function renderSources() {
  clear(elements.sourceGrid);
  state.report.sources.forEach((source) => {
    const selected = state.selectedHarnesses.has(source.id);
    const statusText = statusLabels[source.status] || source.status;
    const tokenText = source.rangeKnownTokens
      ? `${source.rangeComplete ? "" : "≥"}${formatCompact(source.rangeKnownTokens)}`
      : "—";
    const tooltip = coverageTooltip(source, statusText);
    const item = document.createElement("label");
    item.className = `harness-item source-${source.id}`;
    item.classList.toggle("selected", selected);
    item.title = tooltip;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected;
    checkbox.setAttribute(
      "aria-label",
      `${source.name}，${tokenText} token${selected ? "，已选中" : "，未选中"}`,
    );
    checkbox.title = tooltip;
    checkbox.addEventListener("change", (event) => {
      event.preventDefault();
      toggleSource(source.id);
    });

    const name = document.createElement("span");
    name.className = "harness-name";
    name.textContent = source.name;

    const usage = document.createElement("span");
    usage.className = "harness-usage";
    usage.textContent = tokenText;
    usage.setAttribute("aria-hidden", "true");

    item.append(checkbox, name, usage);
    elements.sourceGrid.append(item);
  });
}

function renderMeta() {
  const { cache, generatedAt, timezone } = state.report;
  setText(
    elements.scanMeta,
    `${cache.indexedFiles} 个文件 · ${cache.parsedFiles} 个更新 · ${cache.durationMs} ms`,
  );
  setText(
    elements.lastUpdated,
    `更新于 ${timeFormatter.format(new Date(generatedAt))} · ${timezone}`,
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
  setText(elements.harnessHeading, `下钻 · ${displayName}`);
  document.title = `${t("title.drilldown")} · ${displayName}`;

  setText(
    elements.harnessRangeCaption,
    `${formatDay(range.from)} — ${formatDay(range.to)}`,
  );
  setText(
    elements.harnessSubtitle,
    [
      `${summary.complete ? "" : "≥"}${formatFull(summary.sessions)} 个会话`,
      `${summary.complete ? "" : "≥"}${formatFull(summary.requests)} 次请求`,
      summary.inputTokens
        ? `缓存率 ${(summary.cacheRate * 100).toFixed(1)}%`
        : "缓存率 —",
    ].join(" · "),
  );

  setText(
    elements.harnessAccuracy,
    summary.complete ? "精确" : "至少",
  );
  elements.harnessAccuracy.classList.toggle("partial", !summary.complete);
  setText(
    elements.harnessTokens,
    `${summary.complete ? "" : "≥"}${formatCompact(summary.knownTokens)}`,
  );
  setText(elements.harnessInputTokens, formatMetric(summary.inputTokens, summary.inputKnown));
  setText(elements.harnessOutputTokens, formatMetric(summary.outputTokens, summary.outputKnown));
  elements.harnessInputTokens.title = formatKnown(summary.inputTokens, summary.inputKnown);
  elements.harnessOutputTokens.title = formatKnown(summary.outputTokens, summary.outputKnown);
  setText(
    elements.harnessCacheNote,
    summary.inputTokens
      ? `缓存读取 ${formatMetric(summary.cacheReadTokens, summary.inputKnown)}`
      : "缓存读取 —",
  );

  clear(elements.harnessProviders);
  const providers = report.breakdowns.providers || [];
  if (providers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = "暂无 Provider 数据。";
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
        `${item.name} ${item.complete ? "" : "至少 "}${formatFull(item.knownTokens)} token`,
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
    empty.textContent = "暂无 Model 数据。";
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
        usage.title = `${formatKnown(row.knownTokens, row.complete)} token`;
        const requests = document.createElement("span");
        requests.className = "rank-requests";
        requests.textContent = `${row.complete ? "" : "≥"}${formatFull(row.requests)}`;
        requests.title = `${formatKnown(row.requests, row.complete)} 次请求`;
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
    if (!response.ok) throw new Error(value.detail || value.error || "读取失败");
    state.drilldown = value;
  } catch (error) {
    showToast(`读取下钻数据失败：${error.message}`);
    return;
  }
  renderHarness();
}

function renderView() {
  if (!state.report) return;
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
    setText(elements.harnessHeading, `下钻 · ${state.report ? (harnessDisplayName(route.name) || route.name) : route.name}`);
    loadDrilldown();
  }
  applyDocumentTitle();

  renderView();
}

async function loadReport({ refresh = false } = {}) {
  if (state.loading) return;
  const firstLoad = !state.initialized;
  setLoading(true, firstLoad);
  if (refresh) setText(elements.loadingTitle, "正在检查变化的日志");

  const parameters = new URLSearchParams({ range: state.range });
  if (refresh) parameters.set("refresh", "1");
  if (state.initialized && state.selectedHarnesses.size > 0) {
    parameters.set("harnesses", [...state.selectedHarnesses].join(","));
  }

  try {
    const response = await fetch(`/api/usage?${parameters}`);
    const value = await response.json();
    if (!response.ok) throw new Error(value.detail || value.error || "读取失败");
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
    showToast(`扫描失败：${error.message}`);
  } finally {
    setLoading(false, firstLoad);
    setText(elements.loadingTitle, "正在扫描本机日志");
  }
  if (state.report) renderView();
}

async function toggleSource(sourceId) {
  if (state.loading) return;
  if (state.selectedHarnesses.has(sourceId)) {
    if (state.selectedHarnesses.size === 1) {
      showToast("至少保留一个 Harness。你也可以选择一个暂无数据的来源查看空状态。");
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
  renderView();
});
applyRoute();
loadReport();
