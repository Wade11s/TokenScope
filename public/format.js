// Number presentation for TokenScope.
//
// 完整数字: western-grouped integers with no scale suffix.
// 英文进位: K / M / B / T, at most one decimal, no space.
// Both UI languages share this module; dates stay in i18n.js.

const SUFFIXES = ["", "K", "M", "B", "T"];
const fullFormatter = new Intl.NumberFormat("en");

export function formatFull(value) {
  return fullFormatter.format(Math.round(Number(value) || 0));
}

export function compactScale(value) {
  const amount = Math.abs(Number(value) || 0);
  if (amount < 1000) return { divisor: 1, suffix: "" };

  let exp = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(amount) / 3));
  let divisor = 1000 ** exp;
  const rounded = Math.round((amount / divisor) * 10) / 10;
  if (rounded >= 1000 && exp < SUFFIXES.length - 1) {
    exp += 1;
    divisor = 1000 ** exp;
  }
  return { divisor, suffix: SUFFIXES[exp] };
}

function formatScaled(value, divisor, suffix) {
  if (!suffix) return formatFull(value);
  const rounded = Math.round((Number(value) / divisor) * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}${suffix}`;
}

export function formatCompact(value) {
  const amount = Number(value) || 0;
  if (!amount) return "0";
  const { divisor, suffix } = compactScale(amount);
  return formatScaled(amount, divisor, suffix);
}

export function formatAxisTick(value, scale) {
  const amount = Number(value) || 0;
  if (!amount) return "0";
  return formatScaled(amount, scale.divisor, scale.suffix);
}

export function formatKnown(value, known) {
  if (!known && !value) return "—";
  return `${known ? "" : "≥"}${formatFull(value)}`;
}

export function formatMetric(value, known) {
  if (!known && !value) return "—";
  return `${known ? "" : "≥"}${formatCompact(value)}`;
}
