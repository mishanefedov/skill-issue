# Why won't my skill fire?

You wrote a skill, installed it, and the coding agent keeps doing the task some
other way. No error. The skill just sits there. Here is why that happens and how
to diagnose it.

## The one thing that decides activation

A coding agent (Claude Code, Codex, Cursor, opencode, Factory) does **not** read
your skill's body to decide whether to use it. At selection time it sees only the
always-on activation surface — the `name` and `description` in the SKILL.md
frontmatter. Everything else (the instructions, the examples, the bash) is loaded
*after* the skill is already chosen.

So a skill can be perfectly implemented and still never fire, for one of a small
number of reasons.

## The failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Never fires, ever | Empty or missing `description` — the picker has nothing to match | Add a description: `<what it does>. Use when <triggers>.` |
| Fires for the wrong phrasings | Description describes *what it is*, not *when to use it* | Add an explicit `Use when …` clause with the literal phrases users type |
| Fires sometimes, not others | Description is too thin/generic to match varied phrasing | Add specific, rare terms (tool names, verbs, file types) users actually say |
| Two skills, only one ever wins | A more specific sibling **shadows** it — they collide on the same intent | Differentiate the descriptions so each owns a distinct intent |
| Fires but the agent picks a default behavior instead | Trigger vocabulary doesn't overlap with the request | Mirror the user's words in the description |

## How to diagnose it in 10 seconds

[`skill-issue`](https://github.com/mishanefedov/skill-issue) audits exactly the
metadata the picker reads:

```bash
skill-issue ~/.claude/skills                       # grade every skill A–F
skill-issue ~/.claude/skills --why "your prompt"   # which skill fires for this prompt, and why
skill-issue ~/.claude/skills --collisions          # which skills shadow each other
skill-issue ~/.claude/skills --fix                 # append a "Use when …" clause to weak ones
```

`--why` scores each skill by how much of the prompt's rare, specific vocabulary
its description covers. A small margin between the top two means they collide on
that intent. If even the top score is weak, *no skill reliably fires* — which is
the diagnosis when one should have.

## Related

- The activation half is `skill-issue` (this tool).
- The drift half is [`skillrot`](https://github.com/mishanefedov/skillrot):
  skills that call CLIs the installed version no longer accepts.
