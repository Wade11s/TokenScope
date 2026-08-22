const state = {
  range: "30d",
  route: { view: "overview" },
  selectedHarnesses: new Set(),
  initialized: false,
  report: null,
  breakdown: "providers",
  loading: false,
  activityDays: new Map(),
};

const elements = {
  navLinks: document.querySelectorAll(".main-nav a"),
  viewOverview: document.querySelector("#view-overview"),
  viewRank: document.querySelector("#view-rank"),
  viewHarness: document.querySelector("#view-harness"),
  rankRangeCaption: document.querySelector("#rankRangeCaption"),
  harnessRangeCaption: document.querySelector("#harnessRangeCaption"),
  harnessHeading: document.querySelector("#harnessHeading"),
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

  visible.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `breakdown-row palette-${index % 7}`;

    const name = document.createElement("div");
    name.className = "breakdown-name";
    const swatch = document.createElement("span");
    swatch.className = "breakdown-swatch";
    const label = document.createElement("span");
    label.textContent = item.name;
    label.title = state.breakdown === "models" ? `${item.provider} / ${item.name}` : item.name;
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
    elements.breakdownList.append(row);
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

function placeholderWindowText() {
  const { range } = state.report;
  return `${formatDay(range.from)} — ${formatDay(range.to)}`;
}

function renderView() {
  if (!state.report) return;
  if (state.route.view === "overview") {
    render();
    return;
  }
  const windowText = placeholderWindowText();
  setText(elements.rankRangeCaption, windowText);
  setText(elements.harnessRangeCaption, windowText);
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

const VIEW_ELEMENTS = {
  overview: "viewOverview",
  rank: "viewRank",
  harness: "viewHarness",
};

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
    setText(elements.harnessHeading, `下钻 · ${route.name}`);
    document.title = `TokenScope · 下钻 · ${route.name}`;
  } else if (route.view === "rank") {
    document.title = "TokenScope · 排行";
  } else {
    document.title = "TokenScope · 个人用量";
  }

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
  });
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
applyRoute();
loadReport();
