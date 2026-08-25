// 总览 Harness card marks and usage sort (WADE-34).
//
// Known ids map to locally vendored SVG files under /logos. Runtime markup
// never hotlinks third-party URLs. Unknown ids keep a two-letter fallback.
// Sources: Simple Icons (CC0) for Claude, Gemini, Kimi, Copilot, Cursor,
// OpenCode, Vercel/fx; Lobe Icons (MIT) for Codex, Grok, Hermes/Nous;
// official pi.dev, omp.sh, and Factory.ai marks for Pi, OMP, and Droid;
// Continue's widely used hexagonal mark; Aider uses a compact A derived
// from its official pin-tab silhouette.

export const HARNESS_LOGO_IDS = Object.freeze([
  "codex",
  "claude",
  "gemini",
  "grok",
  "kimi",
  "pi",
  "hermes",
  "droid",
  "fx",
  "copilot",
  "continue",
  "omp",
  "opencode",
  "cursor",
  "aider",
]);

const LOGO_IDS = new Set(HARNESS_LOGO_IDS);

export function harnessLogoSrc(id) {
  return LOGO_IDS.has(id) ? `/logos/${id}.svg` : null;
}

export function harnessMarkFallback(id) {
  const fallback = String(id || "").replace(/[^a-z0-9]/gi, "").slice(0, 2);
  return fallback ? fallback.toUpperCase() : "?";
}

export function sourceRangeUsage(source) {
  const tokens = Number(source?.rangeKnownTokens) || 0;
  return tokens > 0 ? tokens : 0;
}

export function sortSourcesByRangeUsage(sources) {
  return [...sources].sort((left, right) => {
    const leftTokens = sourceRangeUsage(left);
    const rightTokens = sourceRangeUsage(right);
    const leftHasUsage = leftTokens > 0;
    const rightHasUsage = rightTokens > 0;
    if (leftHasUsage !== rightHasUsage) return leftHasUsage ? -1 : 1;
    if (rightTokens !== leftTokens) return rightTokens - leftTokens;
    return String(left?.id || "").localeCompare(String(right?.id || ""));
  });
}

if (typeof window !== "undefined") {
  window.tokenscopeHarness = {
    HARNESS_LOGO_IDS,
    harnessLogoSrc,
    harnessMarkFallback,
    sourceRangeUsage,
    sortSourcesByRangeUsage,
  };
}
