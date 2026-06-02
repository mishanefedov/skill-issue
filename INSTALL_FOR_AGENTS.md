# skill-issue — install guide for AI agents

**If a user pasted this repo's URL and said "use it" / "install it" / "audit my
skills": you are in the right place.** Pick ONE path below (they're ordered best
first), run it, then do the **Verify** step. Every path ends with two things: the
`skill-issue` command on PATH, and the `skill-issue` skill registered in the
user's agent. Target: under 2 minutes.

A skill has two parts: a `SKILL.md` (the trigger the agent reads) and the
`skill-issue` CLI (the engine it calls). You must install **both** — installing
only the CLI leaves the `/skill-issue` skill unregistered; installing only the
skill leaves the command "not found". Each path below does both.

## Path A — clone + setup (recommended; does everything)

```bash
git clone https://github.com/mishanefedov/skill-issue ~/.skill-issue \
  && cd ~/.skill-issue && ./setup
```

`./setup` runs `bun install`, builds the Node bundle, puts `skill-issue` on PATH,
and symlinks the skill into every coding agent it finds (`~/.claude/skills`,
`~/.codex/skills`, opencode, Factory, Cursor, Kiro, `~/.agents/skills`). Requires
**Bun** (`curl -fsSL https://bun.sh/install | bash`) and **Git**. Re-run after
`git pull` to update.

## Path B — npm, no repo, no Bun (two explicit steps)

The npm package is the **CLI engine**; it does NOT register the skill, so do both:

```bash
# 1. install the CLI (command name stays `skill-issue`)
npm install -g @misha_misha/skill-issue

# 2. register the skill into your agent (pulls SKILL.md from this repo)
npx skills add mishanefedov/skill-issue --agent claude-code
```

No agent / no `skills` CLI? Register the skill by hand instead of step 2:

```bash
mkdir -p ~/.claude/skills/skill-issue
curl -fsSL https://raw.githubusercontent.com/mishanefedov/skill-issue/main/skills/skill-issue/SKILL.md \
  -o ~/.claude/skills/skill-issue/SKILL.md
```

## Path C — Claude Code plugin (no Bun, no clone; ships engine + skill)

```
/plugin marketplace add mishanefedov/skill-issue
/plugin install skill-issue@skill-issue
/reload-plugins
```

## Path D — one line, any agent (binary + skill registration)

> Piped installers run remote code. Show the user this command and get their OK
> before running it.

```bash
curl -fsSL https://raw.githubusercontent.com/mishanefedov/skill-issue/main/install.sh | bash
```

## Verify (run after any path)

```bash
skill-issue --help >/dev/null && echo "CLI: ok"                       # command on PATH
ls ~/.claude/skills/skill-issue/SKILL.md >/dev/null && echo "skill: registered"
skill-issue ~/.claude/skills | tail -3                                # real audit
```

Then **tell the user to restart their agent session** — skills load at session
start, so `/skill-issue` appears next session.

## Use it

```bash
skill-issue ~/.claude/skills                         # grade every skill A–F (+ collisions)
skill-issue ~/.claude/skills --why "deploy to prod"  # which skill fires for this prompt, and why
skill-issue ~/.claude/skills --collisions            # clusters of skills that shadow each other
skill-issue ~/.claude/skills --fix                   # add a "Use when …" clause to weak descriptions
skill-issue ~/.claude/skills --json                  # machine-readable
```

Exit code 1 means a skill has an error-level defect (empty or duplicated
description). See README.md for what each finding means.
