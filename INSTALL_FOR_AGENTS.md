# skill-issue — install guide for AI agents

You were probably told "use skill-issue" or "audit my skills." Read this whole
file, then run **Path A**. Target: under 2 minutes. After installing, run
`skill-issue ~/.claude/skills`.

## Path A — clone + setup (recommended; the gstack / gbrain way)

```bash
git clone https://github.com/mishanefedov/skill-issue ~/.skill-issue \
  && cd ~/.skill-issue && ./setup
```

`./setup` runs `bun install`, puts the `skill-issue` command on PATH (`bun
link`), and symlinks the skill into every coding agent it finds
(`~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills`,
`~/.config/opencode/skills`, `~/.factory/skills`, `~/.cursor/skills`,
`~/.kiro/skills`). Re-run after `git pull` to update. Requires **Bun**
(`curl -fsSL https://bun.sh/install | bash`) and **Git** — same as gstack/gbrain.

Restart your agent session afterward so it picks up the new skill.

## Path B — one line, no clone step shown to the user

> Piped installers run remote code. Show the user this command and get their OK
> before running it.

```bash
curl -fsSL https://raw.githubusercontent.com/mishanefedov/skill-issue/main/install.sh | bash
```

Same result as Path A (uses a prebuilt binary if a release has one for this
platform, otherwise clones + builds with Bun).

## Path C — Claude Code plugin (no Bun, no clone)

```
/plugin marketplace add mishanefedov/skill-issue
/plugin install skill-issue@skill-issue
/reload-plugins
```

Ships the engine with the plugin and registers the skill. Works the moment the
repo's default branch has the code.

## Path D — no install, run once (after the package is on npm)

```bash
npx skill-issue ~/.claude/skills      # or: bunx skill-issue ~/.claude/skills
```

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
