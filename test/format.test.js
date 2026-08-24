import assert from "node:assert/strict";
import test from "node:test";
import {
  compactScale,
  formatAxisTick,
  formatCompact,
  formatFull,
  formatKnown,
  formatMetric,
} from "../public/format.js";

test("完整数字 uses western thousands separators", () => {
  assert.equal(formatFull(0), "0");
  assert.equal(formatFull(1234), "1,234");
  assert.equal(formatFull(123000000), "123,000,000");
  assert.equal(formatFull(1200000000.4), "1,200,000,000");
});

test("英文进位 steps by thousands and keeps one decimal", () => {
  assert.equal(formatCompact(0), "0");
  assert.equal(formatCompact(999), "999");
  assert.equal(formatCompact(1000), "1K");
  assert.equal(formatCompact(1234), "1.2K");
  assert.equal(formatCompact(1250), "1.3K");
  assert.equal(formatCompact(85000000), "85M");
  assert.equal(formatCompact(123000000), "123M");
  assert.equal(formatCompact(1200000000), "1.2B");
  assert.equal(formatCompact(1e12), "1T");
});

test("英文进位 strips trailing .0 and promotes 1000 of a unit", () => {
  assert.equal(formatCompact(1000000), "1M");
  assert.equal(formatCompact(999500), "999.5K");
  assert.equal(formatCompact(999950), "1M");
});

test("axis ticks share the max scale including sub-1 values", () => {
  const million = compactScale(120000000);
  assert.equal(million.suffix, "M");
  assert.equal(formatAxisTick(120000000, million), "120M");
  assert.equal(formatAxisTick(90000000, million), "90M");
  assert.equal(formatAxisTick(0, million), "0");

  const billion = compactScale(1200000000);
  assert.equal(billion.suffix, "B");
  assert.equal(formatAxisTick(300000000, billion), "0.3B");
});

test("下界 prefixes both formats and blanks unknown zeros", () => {
  assert.equal(formatKnown(123000000, true), "123,000,000");
  assert.equal(formatKnown(123000000, false), "≥123,000,000");
  assert.equal(formatKnown(0, false), "—");
  assert.equal(formatMetric(85000000, true), "85M");
  assert.equal(formatMetric(85000000, false), "≥85M");
  assert.equal(formatMetric(0, false), "—");
});
