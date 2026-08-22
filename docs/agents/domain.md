# Domain Docs

How the engineering skills should consume this repository’s domain
documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- Relevant ADRs under `docs/adr/`.

If either location does not exist, proceed silently. Do not flag its absence or
suggest creating it upfront. The domain-modeling workflow creates domain
documentation lazily when terminology or decisions are actually resolved.

## File structure

This repository uses a single-context layout:

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-example-decision.md
│   └── 0002-another-decision.md
└── src/
```

## Use the glossary’s vocabulary

When output names a domain concept—in an issue title, refactor proposal,
hypothesis, or test name—use the term defined in `CONTEXT.md`. Do not drift to
synonyms the glossary explicitly avoids.

If a needed concept is absent, reconsider whether the term belongs to the
project or record the gap for the domain-modeling workflow.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface that conflict explicitly
instead of silently overriding the decision.
