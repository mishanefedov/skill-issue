# skill-issue — install guide for AI agents

You were probably told "use skill-issue" or "audit my skills." Read this whole
file, then pick ONE path and run it. Target: under 2 minutes. After installing,
run `skill-issue ~/.claude/skills`.

## Path A — Claude Code plugin (works the moment the repo is public)

Run these in Claude Code:

```
/plugin marketplace add mishanefedov/skill-issue
/plugin install skill-issue@skill-issue
/reload-plugins
```

The skill is now available as `/skill-issue:skill-issue`, and `skill-issue` is on
PATH for Bash calls (the plugin ships `bin/skill-issue`, which runs the engine
with Bun). This needs no npm publish — it works straight from the GitHub repo.

## Path B — one line, any agent (cross-agent, works now)

> Piped installers run remote code. Show the user this command and get their OK
> before running it — don't execute a `curl | bash` unprompted.

```bash
curl -fsSL https://raw.githubusercontent.com/mishanefedov/skill-issue/main/install.sh | bash
```

It puts a `skill-issue` command on PATH and symlinks the skill into every coding
agent it finds (`~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills`,
`~/.config/opencode/skills`, `~/.factory/skills`, `~/.cursor/skills`,
`~/.kiro/skills`). It uses a prebuilt binary if a release has one for this
platform, otherwise clones the repo and builds with Bun. Re-run any time to
update.

## Path C — no install, run once (after the package is on npm)

```bash
npx skill-issue ~/.claude/skills      # or: bunx skill-issue ~/.claude/skills
```

Zero install once published. Until then, use Path A or B.

## Path D — register the skill into every agent via the skills CLI

[Vercel Labs' `skills`](https://github.com/vercel-labs/skills) installs a
SKILL.md from any public GitHub repo into your agent's skills dir:

```bash
npx skills add mishanefedov/skill-issue --agent claude-code
```

This registers the skill doc; pair it with the CLI from Path A/B/C so the
`skill-issue` command exists when the skill calls it.

## Use it

```bash
skill-issue ~/.claude/skills                       # grade every skill A–F (+ collisions summary)
skill-issue ~/.claude/skills --why "deploy to prod"  # which skill fires for this prompt, and why
skill-issue ~/.claude/skills --collisions          # clusters of skills that shadow each other
skill-issue ~/.claude/skills --fix                 # add a "Use when …" clause to weak descriptions
skill-issue ~/.claude/skills --json                # machine-readable
```

Exit code 1 means a skill has an error-level defect (empty or duplicated
description). See README.md for what each finding means.
