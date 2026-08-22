# Repository Guidelines

## Project Structure & Module Organization

TokenScope is a dependency-free Node.js 20+ application using ES modules.

- `src/adapters/`: one local usage parser per harness, such as `codex.js` or `kimi.js`. Register new adapters in `src/adapters/index.js`.
- `src/lib/`: shared JSONL/file utilities and the normalized usage-record model.
- `src/indexer.js`: incremental file indexing and cache management.
- `src/report.js`: range filtering and provider/model/harness aggregation.
- `src/server.js` and `src/scan.js`: local HTTP and CLI entry points.
- `public/`: framework-free dashboard HTML, CSS, and browser JavaScript.
- `test/fixtures/`: sanitized format samples; tests live in `test/*.test.js`.
- `dogfood-output/`: browser QA evidence, not application source.

## Build, Test, and Development Commands

- `npm start`: serve the dashboard on `127.0.0.1:4317`.
- `npm run scan -- --range=30d`: print a local 30-day usage report. Valid ranges include `today`, `7d`, `30d`, `90d`, and `all`.
- `npm test`: run the Node built-in test runner.
- `npm run check`: syntax-check server/browser entry points, then run all tests. Use this before submitting changes.

There is no compilation or dependency-install step.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, double quotes, named exports, and `async`/`await`. Keep modules focused and filenames lowercase. Adapter IDs must be stable lowercase identifiers matching their UI source class, for example `grok` and `.source-grok`.

Normalize tokens carefully: cached and reasoning tokens may be either subsets or separate counters depending on the harness. Document the source format and explicitly handle cumulative snapshots, streaming duplicates, and parent/subagent mirrors.

## Testing Guidelines

Use `node:test` with `node:assert/strict`. Name tests by behavior, not implementation. Every new adapter should include a minimal sanitized fixture and assertions for provider, model, input, output, cache fields, request count, and deduplication. Never commit real prompts, responses, credentials, or working-directory details.

## Commit & Pull Request Guidelines

No repository Git history is currently available, so no established commit convention can be inferred. Use short imperative subjects such as `Add Grok usage adapter`.

Pull requests should explain the local data format, normalization rules, duplicate-counting risks, and verification performed. Include `npm run check` results and a screenshot for dashboard changes. Link an issue when applicable.

## Security & Privacy

Keep the server loopback-only. Parsers may retain numeric usage metadata and opaque IDs, but must not cache or expose message bodies, prompts, tool arguments, API keys, or private paths. Mark incomplete sources as lower bounds rather than presenting estimated totals as exact.

## Agent skills

### Issue tracker

Issues are tracked in Linear through Orca’s `orca linear` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The repository uses the five default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a single-context layout. See `docs/agents/domain.md`.
