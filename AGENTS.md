# AGENTS.md — guide for coding agents working in this repo

skill-issue lints coding-agent skills for *activation*: whether the agent will
actually fire a skill, given its always-on name + description. This file is the
tool-agnostic guide (Claude Code, Codex, Cursor, etc. all read it). Sibling tool:
[skillrot](https://github.com/mishanefedov/skillrot) (CLI drift).

## Layout

- `src/` — the engine.
  - `discover.ts` — find SKILL.md / agents under a root, read activation metadata.
  - `frontmatter.ts` — parse (and rewrite) name/description, folded scalars included.
  - `triggers.ts` — tokenize, weight terms (name/use-when boosted), generic stoplist, IDF.
  - `simulate.ts` — `--why`: rank skills for a prompt by rarity-weighted term coverage.
  - `collisions.ts` — `--collisions`: Jaccard over salient terms, union into clusters.
  - `lint.ts` — per-skill activation rules + A–F grade.
  - `fix.ts` — `--fix`: append a body-grounded "Use when …" clause to weak descriptions.
  - `llm.ts` — optional `--llm` judge (shells out to claude/codex; falls back).
  - `report.ts`, `cli.ts`, `types.ts`.
- `skills/skill-issue/SKILL.md` — the skill definition (plugin layout).
- `.claude-plugin/` — Claude Code plugin + marketplace manifests.
- `bin/skill-issue` — launcher (on PATH under the plugin and via `bun link`).
- `test/` — `bun test`; deterministic fixtures (good / vague / colliding / no-when).

## Conventions

- Runtime: **Bun**. No build step for dev — Bun runs the TypeScript directly.
- Zero runtime dependencies. Keep it that way; the engine only uses `node:*`.
- `--llm` is the only network path and is opt-in; everything else is offline.
- Before pushing: `bun run lint`, `bun test`, and `bun run typecheck` must pass.
- Be conservative: only empty/duplicate descriptions are errors; everything that
  merely lowers firing odds (vague, thin, no "use when", collision) is a warning.
  A linter that cries wolf on a 100-skill set gets uninstalled.

## Dogfood

```bash
bun run src/cli.ts skills        # skill-issue audits its own skill (CI does this too)
```
