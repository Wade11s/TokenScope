# Harness coverage inventory

Research artifact for TokenScope. Not part of the product indexer. See [ADR 0001](adr/0001-coverage-inventory-is-research.md).

Re-run the local scan:

```bash
node scripts/scan-local-harnesses.mjs
node scripts/scan-local-harnesses.mjs --json
```

Catalog: `scripts/harness-catalog.json`. Scanner: `scripts/scan-local-harnesses.mjs`.

## Scope

A row is a **Harness**: a terminal-native coding agent that can read a repo, edit files, and run commands.

Included if any of:

1. Listed on [Terminal Trove AI Coding Agents](https://terminaltrove.com/ai-coding-agents/)
2. Listed under terminal-native agents in [awesome-cli-coding-agents](https://github.com/bradAGI/awesome-cli-coding-agents) with GitHub stars ≥ 10k (list dated 2026-08-17)
3. Official CLI from a major lab
4. Already a TokenScope Adapter or Detect-only source
5. **Local-present**: On Path or Configured on this machine, even below the popularity bar. Tag `local-only`. See [ADR 0002](adr/0002-local-present-harnesses-join-catalog.md).

Intake for the next “I have this but it is missing”:

1. Confirm it matches **Harness** (not an Orchestrator, not a capability marketplace such as `@zeroxyz/cli`).
2. Add a row to `scripts/harness-catalog.json` with `tags: ["local-only"]` and `sources: ["local"]`.
3. Re-run `node scripts/scan-local-harnesses.mjs`.
4. If Usage logs exist and look parseable, file a child issue under WADE-11. If only On Path / Configured, leave it in the present-no-logs table.

Excluded: Orchestrators (Ralph TUI, Oh My OpenAgent / `oh-my-opencode`, TermLoop, Warp Factories), the OpenClaw personal-assistant family, and the rest of Terminal Trove’s ~997 generic CLI tools.

Grok CLI and Grok Build share one row (`grok`) because this machine’s `grok` binary and `~/.grok` sessions are what the existing Adapter already reads.

Zero on this machine is [Gitlawb/zero](https://github.com/Gitlawb/zero) (`zero 0.8.0`), not the `zero.xyz` capability CLI. It ships `zero usage report --json` with `inputTokens` / `outputTokens`, but `~/.local/share/zero/sessions` is currently empty.

## Scan columns

| Column | Meaning |
|---|---|
| On Path | Primary CLI resolves to a real file on `PATH` |
| Configured | Product config or data directory exists in this home |
| Usage logs | Session or usage files match the catalog globs (count only; files are not parsed) |
| TokenScope | `adapter` / `detect-only` / `none` |

Do not treat On Path as “installed”. The TokenScope-relevant signal is Usage logs.

## This machine (2026-08-22)

| | Count |
|---|---|
| Catalog | 66 |
| On Path | 16 |
| Configured | 24 |
| Usage logs | 15 |
| Adapter already | 13 |
| Detect-only already | 7 |
| Present with usage logs, no Adapter | 0 |
| Present, no usage logs | 6 |

TT’s largest miss versus this catalog is **Hermes Agent** (already a TokenScope Adapter). Other high-star agents missing from TT include Claw Code, OpenHands, Open Interpreter, Codewhale, Reasonix, Roo Code, SWE-agent, MiMo Code, and Warp Agent.

`oh-my-opencode` is On Path here and is an Orchestrator, so it is out of scope.

### This pass (Orca run_af9c8d5e5439)

| id | TokenScope | Notes |
|---|---|---|
| fx | adapter (partial) | Reads `usage-v2.json`; root `usage.jsonl` has no token fields |
| droid | adapter (partial) | Reads `*.settings.json` snapshots, not transcript JSONL |
| qoder | detect-only | Project JSONL is transcripts only |
| antigravity | detect-only | History/conversation, no usage fields |
| kilo | detect-only | SQLite is session/auth; “token” columns are OAuth |
| kiro | detect-only | History/state/auth only |
| zero | detect-only | `local-only`; session dir empty |

### Present, no usage logs

Configured or On Path, but no session/usage files the catalog knows about.

| id | Name | On Path | Configured | Notes |
|---|---|---|---|---|
| amp | Amp | no | yes | Config only |
| commandcode | CommandCode | no | yes | Settings only |
| devin | Devin for Terminal | no | yes | Config only |
| mimo | MiMo Code | no | yes | Empty product config dir |
| warp | Warp Agent | yes | yes | Terminal config, no usage files found |
| zero | Zero (Gitlawb) | yes | yes | `local-only`; session dir empty; official `zero usage report` exists |
| cursor | Cursor CLI | yes | yes | Detect-only; tracking DB still has no token usage |
| aider | Aider | no | no | Detect-only; not present on this machine |
| gemini | Gemini CLI | no | yes | Adapter exists; no `session-*.json` usage files |
| opencode | OpenCode | yes | yes | Adapter exists; message storage is empty |

### Full matrix

| id | Name | On Path | Configured | Usage logs | files | TokenScope | tags |
|---|---|---|---|---|---|---|---|
| aider | Aider | no | no | no | 0 | detect-only | |
| amazon-q | Amazon Q Developer CLI | no | no | no | 0 | none | first-party |
| amp | Amp | no | yes | no | 0 | none | first-party |
| antigravity | Antigravity CLI | no | yes | yes | 3 | detect-only | first-party |
| auggie | Auggie CLI | no | no | no | 0 | none | first-party, ide-sibling |
| autohand | AutoHand | no | no | no | 0 | none | |
| blackbox | Blackbox AI CLI | no | no | no | 0 | none | |
| claude | Claude Code | yes | yes | yes | 22 | adapter | first-party |
| claude-engineer | Claude Engineer | no | no | no | 0 | none | |
| claurst | Claurst | no | no | no | 0 | none | fork |
| claw-code | Claw Code | no | no | no | 0 | none | fork |
| cline | Cline CLI | no | no | no | 0 | none | ide-sibling |
| codebuff | Codebuff | no | no | no | 0 | none | |
| codewhale | Codewhale | no | no | no | 0 | none | |
| codex | Codex CLI | yes | yes | yes | 394 | adapter | first-party |
| commandcode | CommandCode | no | yes | no | 0 | none | |
| continue | Continue | no | yes | yes | 1 | adapter | inactive |
| copilot | GitHub Copilot CLI | yes | yes | yes | 238 | adapter | first-party, ide-sibling |
| crush | Charm Crush | no | no | no | 0 | none | |
| cursor | Cursor CLI | yes | yes | no | 0 | detect-only | first-party, ide-sibling |
| deepagents | Deep Agents Code | no | no | no | 0 | none | first-party |
| devin | Devin for Terminal | no | yes | no | 0 | none | first-party |
| droid | Droid CLI | yes | yes | yes | 4 | adapter | first-party |
| forgecode | ForgeCode | no | no | no | 0 | none | |
| fx | fx (Vercel) | yes | yes | yes | 9 | adapter | first-party |
| gemini | Gemini CLI | no | yes | no | 0 | adapter | first-party |
| goose | Goose CLI | no | no | no | 0 | none | |
| grok | Grok CLI / Grok Build | yes | yes | yes | 18 | adapter | first-party |
| groq | Groq Code CLI | no | no | no | 0 | none | first-party |
| hermes | Hermes Agent | yes | yes | yes | 2 | adapter | |
| ibm-bob | IBM Bob | no | no | no | 0 | none | first-party |
| jcode | jcode | no | no | no | 0 | none | |
| jules | Jules CLI | no | no | no | 0 | none | first-party |
| junie | Junie CLI | no | no | no | 0 | none | first-party |
| kilo | Kilo Code | yes | yes | yes | 1 | detect-only | |
| kimi | Kimi Code CLI | yes | yes | yes | 34 | adapter | first-party |
| kiro | Kiro CLI | no | yes | yes | 1 | detect-only | first-party |
| letta | Letta Code | no | no | no | 0 | none | |
| mimo | MiMo Code | no | yes | no | 0 | none | first-party |
| mistral-vibe | Mistral Vibe | no | no | no | 0 | none | first-party |
| nanocode | Nanocode | no | no | no | 0 | none | |
| nanocoder | Nanocoder | no | no | no | 0 | none | |
| neovate | Neovate Code | no | no | no | 0 | none | |
| omp | OMP / oh-my-pi | yes | yes | yes | 14 | adapter | |
| open-interpreter | Open Interpreter | no | no | no | 0 | none | |
| openblock | OpenBlock | no | no | no | 0 | none | |
| opencode | OpenCode | yes | yes | no | 0 | adapter | |
| openhands | OpenHands CLI | no | no | no | 0 | none | |
| pi | Pi | yes | yes | yes | 202 | adapter | |
| plandex | Plandex | no | no | no | 0 | none | inactive |
| poolside | Poolside Agent CLI | no | no | no | 0 | none | first-party |
| prime-agent | Prime Agent | no | no | no | 0 | none | |
| qoder | Qoder CLI | yes | yes | yes | 2 | detect-only | |
| qwen | Qwen Code | no | no | no | 0 | none | first-party |
| reasonix | Reasonix | no | no | no | 0 | none | |
| roo | Roo Code CLI | no | no | no | 0 | none | ide-sibling |
| rovodev | Rovo Dev CLI | no | no | no | 0 | none | first-party |
| smol-developer | Smol Developer | no | no | no | 0 | none | |
| snowflake | Snowflake Cortex CLI | no | no | no | 0 | none | first-party |
| swe-agent | SWE-agent | no | no | no | 0 | none | |
| toad | Toad | no | no | no | 0 | none | |
| trae | Trae Agent | no | no | no | 0 | none | first-party |
| vix | Vix | no | no | no | 0 | none | |
| vtcode | VT Code | no | no | no | 0 | none | |
| warp | Warp Agent | yes | yes | no | 0 | none | first-party |
| zero | Zero (Gitlawb) | yes | yes | no | 0 | detect-only | local-only |

## Recommended next Adapters

fx and droid landed in this Orca pass. No remaining local usage-shaped files without an Adapter or Detect-only decision.

Zero stays Detect-only until `~/.local/share/zero/sessions` has files. Do not shell out to `zero usage` inside the indexer.

Linear (all Done):

- [WADE-11](https://linear.app/wade11/issue/WADE-11/expand-tokenscope-harness-coverage-from-the-inventory) parent
- [WADE-12](https://linear.app/wade11/issue/WADE-12/add-fx-adapter-for-vercel-fx-usage-files) fx Adapter
- [WADE-13](https://linear.app/wade11/issue/WADE-13/add-droid-adapter-for-factory-session-jsonl) Droid Adapter
- [WADE-14](https://linear.app/wade11/issue/WADE-14/add-qoder-adapter-for-local-project-jsonl) Qoder Adapter
- [WADE-15](https://linear.app/wade11/issue/WADE-15/investigate-antigravity-kilo-and-kiro-local-usage-stores) Antigravity / Kilo / Kiro investigation
- [WADE-16](https://linear.app/wade11/issue/WADE-16/add-zero-adapter-for-gitlawbzero-session-usage) Zero Adapter (local-only)
