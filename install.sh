#!/usr/bin/env bash
# One-line cross-agent installer:
#   curl -fsSL https://raw.githubusercontent.com/mishanefedov/skill-issue/main/install.sh | bash
#
# Fast path: downloads a prebuilt, self-contained `skill-issue` binary (no Bun,
# no clone) and registers the skill with every coding agent on this machine
# (Claude Code, Codex, opencode, Factory, Cursor, Kiro).
# Fallback: clones the repo and runs the Bun-based setup if no binary fits this
# platform (or no release exists yet). Re-run any time to update.
set -euo pipefail

REPO="https://github.com/mishanefedov/skill-issue"
RAW="https://raw.githubusercontent.com/mishanefedov/skill-issue/main"
DEST="${SKILL_ISSUE_HOME:-$HOME/.skill-issue}"
BINDIR="${SKILL_ISSUE_BIN:-$HOME/.local/bin}"

command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 1; }

# Map this machine to a release asset name. Empty => no prebuilt binary; fall
# back to the Bun path.
asset() {
	local os arch
	os="$(uname -s)"; arch="$(uname -m)"
	case "$os" in
		Darwin) os="darwin" ;;
		Linux)  os="linux" ;;
		*) return 1 ;;
	esac
	case "$arch" in
		arm64|aarch64) arch="arm64" ;;
		x86_64|amd64)  arch="x64" ;;
		*) return 1 ;;
	esac
	echo "skill-issue-$os-$arch"
}

# Symlink the skill into every installed agent's skills dir (and the shared
# ~/.agents/skills). SKILL.md is a shared format, so a symlink is enough.
register_skill() {
	local src="$1"
	register() {
		local agent="$1" base="$2" skills_dir="$3"
		[ -d "$base" ] || return 0
		mkdir -p "$skills_dir"
		ln -sfn "$src" "$skills_dir/skill-issue"
		echo "  ✓ $agent → $skills_dir/skill-issue"
	}
	echo "→ registering the skill with installed agents"
	register "shared (.agents)" "$HOME/.agents"             "$HOME/.agents/skills"
	register "Claude Code"      "$HOME/.claude"              "$HOME/.claude/skills"
	register "Codex"            "$HOME/.codex"               "$HOME/.codex/skills"
	register "opencode"         "$HOME/.config/opencode"     "$HOME/.config/opencode/skills"
	register "Factory"          "$HOME/.factory"             "$HOME/.factory/skills"
	register "Cursor"           "$HOME/.cursor"              "$HOME/.cursor/skills"
	register "Kiro"             "$HOME/.kiro"                "$HOME/.kiro/skills"
	mkdir -p "$HOME/.agents/skills" && ln -sfn "$src" "$HOME/.agents/skills/skill-issue"
}

NAME="$(asset || true)"
URL="$REPO/releases/latest/download/$NAME"

# Fast path: a prebuilt binary exists for this platform and the release has it.
if [ -n "$NAME" ] && curl -fsSL -o /dev/null -I "$URL" 2>/dev/null; then
	echo "→ downloading $NAME"
	mkdir -p "$BINDIR" "$DEST/skills/skill-issue"
	curl -fsSL -o "$BINDIR/skill-issue" "$URL"
	chmod +x "$BINDIR/skill-issue"
	curl -fsSL -o "$DEST/skills/skill-issue/SKILL.md" "$RAW/skills/skill-issue/SKILL.md"
	register_skill "$DEST/skills/skill-issue"

	echo
	echo "Done. 'skill-issue' installed to $BINDIR/skill-issue"
	case ":$PATH:" in
		*":$BINDIR:"*) : ;;
		*) echo "Add it to PATH:  export PATH=\"$BINDIR:\$PATH\"" ;;
	esac
	echo "Try:  skill-issue ~/.claude/skills"
	exit 0
fi

# Fallback: build from source with Bun (unsupported platform, or no release yet).
echo "→ no prebuilt binary for this platform; building from source with Bun"
command -v git >/dev/null 2>&1 || { echo "git is required for the source install." >&2; exit 1; }

if [ -d "$DEST/.git" ]; then
	echo "→ updating $DEST"
	git -C "$DEST" pull --ff-only --quiet
else
	echo "→ cloning into $DEST"
	git clone --depth 1 --quiet "$REPO" "$DEST"
fi

if ! command -v bun >/dev/null 2>&1; then
	echo "→ installing Bun"
	curl -fsSL https://bun.sh/install | bash
	export PATH="$HOME/.bun/bin:$PATH"
fi

exec "$DEST/setup"
