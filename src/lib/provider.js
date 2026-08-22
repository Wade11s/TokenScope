/**
 * Provider canonicalization for normalized usage records.
 *
 * Different harnesses and auth flows report the same underlying provider
 * under different aliases: Codex sessions authenticated via OpenAI OAuth
 * surface as "openai-codex", "codex-oauth", or "openai-oauth" depending on
 * the source, and other families carry "-oauth"/"-auth" suffixes or
 * product-vs-company spellings the same way. Aggregation, dedupe, and
 * compaction all key on the provider string, so aliases must collapse to
 * one canonical name at the normalization seam — otherwise a single
 * provider splits into multiple report rows.
 *
 * The mapping is an explicit allowlist and deliberately conservative:
 *
 * - Only the listed aliases are rewritten, each to its family's canonical
 *   name ("openai", "xai", "moonshot", "anthropic", "google-gemini").
 * - Auth-suffix spellings ("-oauth", "-auth") and safe case/separator
 *   variants fold in, because they describe the same provider's auth flow,
 *   never a different biller.
 * - Distinct billing or routing providers are intentionally NOT merged:
 *   "amazon-bedrock", "google-vertex", and "azure-foundry" are separate
 *   clouds even when they serve Anthropic or OpenAI models; "openrouter"
 *   and "github-copilot" are distinct resellers; "anthropic-compatible"
 *   and "local-proxy" mark third-party endpoints, not the vendor itself;
 *   bare "codex" and "grok" are harness/product names, not provider ids.
 * - Unknown providers pass through unchanged, preserving their original
 *   case and separators, so no adapter- or UI-specific guesswork leaks
 *   into this module and no future alias is silently folded in.
 * - Non-string and empty values pass through untouched; the record seam
 *   (`makeRecord` in usage.js) owns the "unknown" fallback.
 * - Inference is orthogonal: canonicalization never touches
 *   `providerInferred`, which keeps its existing semantics.
 */

const ALIAS_TO_CANONICAL = new Map([
  // OpenAI direct API and Codex/ChatGPT-subscription auth spellings.
  ["openai", "openai"],
  ["open-ai", "openai"],
  ["openai-codex", "openai"],
  ["codex-oauth", "openai"],
  ["openai-oauth", "openai"],
  ["openai-codex-oauth", "openai"],

  // xAI direct API and OAuth/API-key spellings (Grok models).
  ["xai", "xai"],
  ["xai-oauth", "xai"],
  ["xai-auth", "xai"],

  // Moonshot AI platform API and Kimi coding-product spellings.
  ["moonshot", "moonshot"],
  ["moonshot-ai", "moonshot"],
  ["moonshotai", "moonshot"],
  ["kimi", "moonshot"],
  ["kimi-code", "moonshot"],
  ["kimi-coding", "moonshot"],
  ["kimi-for-coding", "moonshot"],

  // Anthropic direct API auth spellings. Bedrock/Vertex/Foundry routing
  // and "*-compatible" endpoints stay distinct on purpose.
  ["anthropic", "anthropic"],
  ["anthropic-oauth", "anthropic"],
  ["anthropic-auth", "anthropic"],

  // Google Gemini CLI spelling vs bare harness provider ids.
  ["google-gemini", "google-gemini"],
  ["gemini", "google-gemini"],
  ["gemini-oauth", "google-gemini"],
  ["gemini-auth", "google-gemini"],
  ["google-gemini-oauth", "google-gemini"],
  ["google-gemini-auth", "google-gemini"],
]);

/**
 * Normalize a candidate purely for allowlist lookup: trim surrounding
 * whitespace, lowercase, and collapse runs of spaces/underscores/hyphens to
 * a single hyphen. Never returned for values outside the allowlist.
 */
function lookupKey(value) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "-");
}

/**
 * Return the canonical provider name for a raw provider string.
 *
 * Canonicalizes the OpenAI (openai, openai-codex, codex-oauth, …), xAI
 * (xai, xai-oauth, xai-auth), Moonshot/Kimi (kimi-for-coding,
 * kimi-coding, kimi-code, kimi, moonshot[-ai]), Anthropic direct-API
 * (anthropic, anthropic-oauth, anthropic-auth), and Gemini (gemini,
 * google-gemini, plus auth suffixes) alias families to their canonical
 * names, accepting safe case/separator variants such as "OpenAI-Codex",
 * "codex_oauth", or "open ai". Anything else — including bare "codex"
 * (a harness name), "grok" (a product name), and the distinct billing
 * providers "amazon-bedrock", "google-vertex", "azure-foundry",
 * "openrouter", "github-copilot", "anthropic-compatible" — is returned
 * unchanged. Non-string and empty inputs are returned as-is.
 */
export function canonicalProvider(provider) {
  if (typeof provider !== "string" || provider.length === 0) return provider;
  return ALIAS_TO_CANONICAL.get(lookupKey(provider)) ?? provider;
}

/** Read-only view of the explicit alias table, for tests and docs. */
export const PROVIDER_ALIASES = Object.freeze(new Map(ALIAS_TO_CANONICAL));
