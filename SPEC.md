# skill-issue — spec

> **skill-issue** — find out why your skill won't fire.
>
> A linter for coding-agent **skill activation**. Sibling to
> [skillrot](https://github.com/mishanefedov/skillrot): skillrot catches skills
> that *rot* (the CLIs they call move on); skill-issue catches skills that
> *won't fire* (the agent never picks them, or picks the wrong one). Same
> conservative "don't cry wolf" philosophy, same packaging.

Status: v0.1.0.

---

## 1. The problem

A coding agent decides which skill to run from each skill's always-on metadata —
its `name` and `description`. Two failure modes are now everywhere as skill
counts climb past dozens per machine:

1. **Dead descriptions** — a `description:` is too vague, too short, or missing a
   "use when …" trigger clause, so the model never selects the skill for the way
   users actually phrase requests. The skill is installed but invisible.
2. **Trigger collisions** — two skills compete for the same intent ("review my
   code"). Install both and one silently always loses; its author never learns
   theirs is the loser.

There is no tooling for "why didn't my skill fire?" You edit the description,
guess, reload, retry. skill-issue audits exactly the metadata the picker reads
and predicts what it will do — before you ship.

## 2. Who it's for

Two audiences, often the same person:

- **Skill consumers** who run many skills and drive them with natural-language
  requests rather than typing exact `/command` names. They depend on correct
  auto-activation; a skill that fails to fire on a real-world phrasing costs them
  silently. `--why` and `--collisions` are for them.
- **Skill authors** who write `SKILL.md` / `AGENTS.md` / subagent descriptions
  and publish to marketplaces. `lint` and `--fix` audit the surface they produce.

Design follows from this: the consumer pain (right skill didn't fire across a
crowded set) is the wedge, so `--why`/`--collisions` lead; author-side `lint` is
the broad-market follow-on.

## 3. What it does (v1)

A zero-dependency CLI + a `SKILL.md` skill, structured as a drop-in sibling of
skillrot. Four jobs:

### `lint` (default) — per-skill activation audit
Static scoring of each skill's pickability. Conservative — error only on clear
breakage, everything else graded:

- **error**: empty/missing `description`; `name`+`description` collide verbatim
  with another skill.
- **warning**: no "use when …" / trigger clause; description too thin to match
  varied phrasings or so heavy it taxes always-on context; high generic-term
  ratio ("helps with code"); description merely restates the name; too few
  distinct trigger terms.
- Output per skill: grade **A–F**, the failing rules, a concrete fix line. Exit
  code 1 when any error exists (gates a commit hook).

### `--why "<prompt>"` — activation simulator (headline)
Given a sample prompt, predict which skill the agent would fire and **why**,
ranked, with the margin:

```
$ skill-issue ~/.claude/skills --why "deploy the app to prod"
  1. ship          0.71   ← would fire
  2. land-deploy   0.68   (margin 0.03 — ambiguous, likely collision)
  3. canary        0.41
  your skill "rollout" scored 0.12 — loses to `ship`; missing trigger terms:
  deploy, prod, release. Add them to its description.
```

Default scoring is **heuristic and offline**: extract trigger terms per skill
(name + description + parsed "use when" list), score each against the prompt with
TF-IDF-style weighting across the skill set (rare terms weigh more), report
winner + runner-up + margin. A low top score is itself the diagnosis: "no skill
would fire for this prompt." `--llm` (opt-in) swaps in a real model judge.

The heuristic and fixtures target **terse, under-specified prompts** ("deploy",
"fix this", "merge it") — the realistic adversary. A skill that only fires on a
perfectly worded query is broken in practice.

### `--collisions` — cross-skill ambiguity report
Cluster skills by overlapping trigger terms (Jaccard). For each cluster: the
shared terms, the likely winner, and which skills are shadowed. The "you
installed two skills that fight, one never runs" report.

### `--fix` — rewrite weak descriptions
Conservative, like skillrot's `--fix`. Rewrites a flagged description into the
disambiguated form `"<what it does>. Use when <triggers>."`, grounded in the
skill body so it never invents capabilities. Prints a diff; high-confidence only.

## 4. CLI surface

```
skill-issue <dir>                    # full audit: lint + collisions summary (exit 1 on error)
skill-issue <dir> --why "<prompt>"   # simulate which skill fires for a prompt
skill-issue <dir> --collisions       # collision report only
skill-issue <dir> --fix              # rewrite weak descriptions in place
skill-issue <dir> --llm              # use a real model judge for scoring/simulate
skill-issue <dir> --json             # machine-readable
```

`<dir>` is a folder of skills (each subdir holds `SKILL.md`) or a single skill
dir — identical semantics to skillrot. It also audits a repo's in-tree agent
definitions (`agents/`, `skills/`), so `skill-issue ./` works inside a product,
not only against `~/.claude/skills`.

## 5. Architecture (mirrors skillrot)

TypeScript + Bun, bundled to a dependency-free `dist/skill-issue.mjs`. Heuristic
mode is fully offline; the only optional network is `--llm`.

```
src/
  types.ts
  frontmatter.ts   # parse name/description/body + "use when" trigger clause
  discover.ts      # find skill dirs / SKILL.md files under a root
  triggers.ts      # trigger-term extraction + generic-term stoplist + tokenizing
  simulate.ts      # rank skills for a prompt (heuristic TF-IDF; optional --llm)
  collisions.ts    # pairwise/cluster trigger-term overlap (Jaccard)
  lint.ts          # per-skill activation rules + A–F grade
  fix.ts           # rewrite weak descriptions, body-grounded
  report.ts        # human + --json output
  cli.ts           # arg parsing
index.ts
bin/skill-issue
scripts/build.ts
test/              # bun test; deterministic fixtures (good / vague / colliding / no-when)
.claude-plugin/{plugin.json,marketplace.json}
skills/skill-issue/SKILL.md
README.md  AGENTS.md  llms.txt  LICENSE  VERSION
```

## 6. The `--llm` judge (optional, flag-gated)

No SDK dependency. Detect and shell out, in order, to the `claude` CLI, the
`codex` CLI, or `ANTHROPIC_API_KEY` via a raw fetch. The judge gets the prompt +
every skill's name/description and returns the same ranked shape the heuristic
returns, so output is identical and the heuristic stays the zero-dep default. If
no model is reachable, fall back to heuristic with a printed note.

## 7. Conservative philosophy (inherited)

Crying wolf gets a linter uninstalled. **error** only for empty description or
verbatim name/trigger duplication; vagueness, thin triggers, and collisions are
graded **warnings**. The heuristic is transparent — it prints the terms it
matched on — so a user can see why something scored low and disagree.

## 8. Roadmap (v2)

- **Semantic collisions** — embedding similarity instead of lexical overlap
  (optional, model-gated).
- **Agent-loop replay** — actually run the agent harness on sample prompts and
  observe selection, instead of predicting. Ground truth.
- **Trigger coverage** — generate likely phrasings of a request (LLM), check each
  fires the intended skill, report blind spots.

## 9. Distribution

Same paths as skillrot: npm (`skill-issue`), `npx skill-issue`, Claude Code
plugin (`/plugin marketplace add mishanefedov/skill-issue`), git clone + `bun
link`. Can also join an umbrella marketplace alongside skillrot so one
`marketplace add` ships both.
