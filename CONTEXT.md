# TokenScope

A local-first dashboard that reads this machine's coding-agent session logs and aggregates token usage by provider, model, harness, and date.

## Language

**Harness**:
A terminal-native coding agent that can autonomously read a repository, edit files, and run commands. TokenScope treats each such product as one source identity.
_Avoid_: terminal tool, CLI utility, IDE plugin, orchestrator

**Orchestrator**:
A layer that launches, sandboxes, or coordinates one or more Harnesses. Not a Harness, and out of scope for coverage work.
_Avoid_: Harness

**Provider**:
The billed or routed model-vendor identity on a usage record, independent of which Harness produced the record.
_Avoid_: Harness, model

**Adapter**:
A TokenScope parser that discovers one Harness's local files and emits normalized token records.
_Avoid_: integration, plugin, connector

**Detect-only source**:
A Harness TokenScope can notice on disk but cannot parse into token records.
_Avoid_: Adapter

**On Path**:
The Harness's primary CLI is executable from this user's PATH and answers version or help.
_Avoid_: Installed

**Configured**:
A product-specific config or data directory exists in this user's home, whether or not the CLI is On Path.
_Avoid_: Installed

**Usage logs**:
Local session or token-usage files for a Harness that could be discovered on this machine, whether or not an Adapter can parse them.
_Avoid_: Installed, Configured

**Local-present**:
A Harness that is On Path or Configured on this machine, even if it fails the popularity bar. It still enters the coverage catalog, tagged `local-only`.
_Avoid_: Installed

## Dashboard views

**总览 (Overview)**:
The dashboard's landing view: summary metric cards, daily trend, composition breakdown, and the twelve-month activity heatmap. Answers "how much did I use overall?"
_Avoid_: Home, 主页

**排行 (Rank)**:
The view that orders usage by exactly one dimension at a time — Provider, Model, or Harness — with an in-view tab switch between them. Answers "who tops the list?"
_Avoid_: Leaderboard, 分类

**下钻 (Harness drill-down)**:
The per-Harness view showing how one specific Harness's usage splits across Providers and Models. Reached from Rank's Harness rows or Overview's composition bars; never shown without an explicit Harness name.
_Avoid_: 详情页, Detail

**构成 (Composition)**:
The Overview panel that breaks the selected range into Provider, Model, or Harness shares as ranked bars.
_Avoid_: 占比

**下界 (Lower bound)**:
A usage figure presented with ≥ / 「至少」 because some contributing sources are incomplete. Never rendered as an exact total.
_Avoid_: 约等于, ~

**完整数字**:
A token or request count written as a western-grouped integer with no scale suffix, such as 123,000,000.
_Avoid_: 万, 亿

**英文进位**:
A compact token count scaled by thousands into K, M, B, or T, with at most one decimal and no space.
_Avoid_: 万, 亿, G
