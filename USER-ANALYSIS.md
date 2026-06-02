# Target user & design rationale

Why skill-issue is shaped the way it is. This is product reasoning about the
people who hit the "my skill didn't fire" problem — not analytics about any
individual.

## The two users

**The power consumer.** Runs dozens of skills across several marketplaces and
plugin sets. Crucially, they rarely type exact `/command` names — they describe
what they want in natural language and trust the agent to pick the right skill.
That trust is the whole point of model-invoked skills, and it's also the failure
surface: when a skill doesn't fire on a real-world phrasing, nothing errors. The
request just gets handled by some other skill, or none, and the user never learns
which skill quietly lost. The more skills installed, the worse the silent
collisions.

**The author.** Writes `SKILL.md`, `AGENTS.md`, and subagent descriptions, often
many at once, and publishes them. Their skill can be perfectly implemented and
still never run because its description doesn't match how users phrase the task,
or because it collides with a more specific sibling. Today they find out only by
manual trial and error.

These are frequently the same person wearing two hats.

## What that implies for the tool

- **Lead with activation, not prose polish.** The sharpest pain is "the right
  skill didn't fire from my phrasing" across a crowded set. So `--why` (simulate
  which skill fires for a given prompt) and `--collisions` (which installed skills
  fight) are the wedge. Author-side `lint` (description quality grading) is the
  broad-market follow-on, not the lede.

- **Model under-specified input.** Real requests are terse and incomplete
  ("deploy", "fix this", "merge it"), not perfectly worded queries. The scoring
  heuristic and the test fixtures target that. A skill that only fires on an ideal
  phrasing is broken in practice, and the simulator must surface exactly that.

- **One command, instant verdict, zero ceremony.** The audience is impatient and
  works fast. Default run prints a verdict and exits — no interactive flow, no
  multi-step wizard. Offline by default; `--llm` is opt-in.

- **Audit in-repo agents too, not only `~/.claude/skills`.** Authors keep
  subagent and skill definitions inside their product repos. `skill-issue ./`
  should audit a repo's `agents/`/`skills/` the same way it audits a personal
  skill folder.

- **Never cry wolf.** On a 100-skill set, a noisy linter gets uninstalled in
  seconds. Errors only for empty or duplicate metadata; everything else is a
  graded warning that explains the terms it matched on, so the user can disagree.

## How it proves itself

The credibility test is a real run: point it at a large, real-world skill set and
report what it finds — descriptions too vague to reliably fire, and collision
clusters where one skill silently always wins. That run is both the validation
that the heuristic works and the most honest way to show the value.
