// Find the skills an agent would load under a root, and read each one's
// activation metadata. Supports a personal skills folder (~/.claude/skills,
// each subdir a skill), a single skill dir (contains SKILL.md), and a code
// repo's in-tree agent definitions (skills/<name>/SKILL.md, agents/*.md).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "./frontmatter.ts";
import type { Skill } from "./types.ts";

const SKIP_DIRS = new Set(["node_modules", ".git", ".cursor", ".opencode", ".codex", "dist", "build"]);
const MAX_DEPTH = 4;

interface Candidate {
	name: string;
	file: string;
	depth: number;
}

/** Walk for SKILL.md files, plus markdown files directly inside an agents/ dir. */
function walk(dir: string, depth: number, out: Candidate[]): void {
	if (depth > MAX_DEPTH) return;
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return;
	}
	const inAgentsDir = dir.split(/[\\/]/).pop() === "agents";
	for (const e of entries) {
		const full = join(dir, e);
		let isDir = false;
		try {
			isDir = statSync(full).isDirectory();
		} catch {
			continue;
		}
		if (isDir) {
			if (SKIP_DIRS.has(e) || e.startsWith(".")) continue;
			walk(full, depth + 1, out);
		} else if (e === "SKILL.md") {
			const name = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;
			out.push({ name, file: full, depth });
		} else if (inAgentsDir && e.endsWith(".md") && e !== "AGENTS.md" && e !== "README.md") {
			out.push({ name: e.replace(/\.md$/, ""), file: full, depth });
		}
	}
}

/** Load every distinct skill under `root`, deduped by name (shallowest wins). */
export function loadSkills(root: string): Skill[] {
	const candidates: Candidate[] = [];
	let isDir = false;
	try {
		isDir = statSync(root).isDirectory();
	} catch {
		return [];
	}
	if (!isDir) return [];

	// A root that is itself a single skill.
	if (readdirSync(root).includes("SKILL.md")) {
		candidates.push({
			name: root.split(/[\\/]/).filter(Boolean).pop() ?? root,
			file: join(root, "SKILL.md"),
			depth: 0,
		});
	} else {
		walk(root, 0, candidates);
	}

	// Dedupe by name, keeping the shallowest path (drops mirror copies nested
	// under a skill's per-agent subdirectories).
	const byName = new Map<string, Candidate>();
	for (const c of candidates) {
		const prev = byName.get(c.name);
		if (!prev || c.depth < prev.depth) byName.set(c.name, c);
	}

	const skills: Skill[] = [];
	for (const c of byName.values()) {
		let content: string;
		try {
			content = readFileSync(c.file, "utf8");
		} catch {
			continue;
		}
		const fm = parseFrontmatter(content);
		skills.push({
			name: fm.name || c.name,
			file: c.file,
			description: fm.description,
			body: fm.body,
		});
	}
	skills.sort((a, b) => a.name.localeCompare(b.name));
	return skills;
}
