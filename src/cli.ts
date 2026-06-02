#!/usr/bin/env bun
// skill-issue — find out why your skill won't fire.

import { existsSync } from "node:fs";
import { findCollisions } from "./collisions.ts";
import { loadSkills } from "./discover.ts";
import { applyFixes } from "./fix.ts";
import { lint } from "./lint.ts";
import { buildCollisionsReport, buildDefaultReport, buildLintReport, buildWhyReport } from "./report.ts";

const HELP = `skill-issue — find out why your skill won't fire.

Usage:
  skill-issue [path] [options]

Arguments:
  path                 Skills root to scan (default: current directory). A folder
                       of skills (each subdir has SKILL.md), a single skill dir,
                       or a repo with skills/ and agents/ definitions.

Options:
  --why "<prompt>"     Simulate which skill the agent would fire for a prompt,
                       ranked, with the margin and the terms each matched on.
  --skill <name>       With --why: focus on one skill and report what prompt
                       vocabulary its description is missing.
  --collisions         Report clusters of skills that compete for the same
                       intent (one silently wins, the others never fire).
  --fix                Rewrite weak descriptions in place: append a "Use when …"
                       trigger clause built from the skill's own vocabulary.
                       Only high-confidence cases; never invents capability.
  --llm                Use a local agent CLI (claude/codex) as the judge for
                       --why instead of the offline heuristic. Falls back if none.
  --json               Emit machine-readable JSON instead of the text report.
  -h, --help           Show this help.

Default (no mode flag): lint — grade every skill A–F on whether it will reliably
fire, plus a one-line collisions summary. Exit code 1 when any skill has an
error-level defect (empty or duplicated description).`;

function main(argv: string[]): number {
	const args = argv.slice(2);
	if (args.includes("-h") || args.includes("--help")) {
		console.log(HELP);
		return 0;
	}

	let path = ".";
	let json = false;
	let fix = false;
	let collisions = false;
	let useLlm = false;
	let why: string | undefined;
	let focusSkill: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const a = args[i] as string;
		if (a === "--json") {
			json = true;
		} else if (a === "--fix") {
			fix = true;
		} else if (a === "--collisions") {
			collisions = true;
		} else if (a === "--llm") {
			useLlm = true;
		} else if (a === "--why") {
			const v = args[++i];
			if (!v || v.startsWith("--")) {
				console.error('skill-issue: --why needs a prompt, e.g. --why "deploy to prod"');
				return 2;
			}
			why = v;
		} else if (a === "--skill") {
			const v = args[++i];
			if (!v || v.startsWith("--")) {
				console.error("skill-issue: --skill needs a skill name");
				return 2;
			}
			focusSkill = v;
		} else if (a.startsWith("-")) {
			console.error(`skill-issue: unknown option '${a}' (try --help)`);
			return 2;
		} else {
			path = a;
		}
	}

	if (!existsSync(path)) {
		console.error(`skill-issue: path not found: ${path}`);
		return 2;
	}

	const skills = loadSkills(path);
	if (skills.length === 0) {
		console.error(`skill-issue: no skills found under ${path} (looked for SKILL.md / agents/*.md)`);
		return 2;
	}

	if (why !== undefined) {
		const report = buildWhyReport(skills, why, { useLlm, focusSkill });
		console.log(json ? JSON.stringify(report.json, null, 2) : report.text);
		return report.exitCode;
	}

	if (collisions) {
		const report = buildCollisionsReport(skills, findCollisions(skills));
		console.log(json ? JSON.stringify(report.json, null, 2) : report.text);
		return report.exitCode;
	}

	if (fix) {
		const { changes } = applyFixes(skills, true);
		if (json) {
			console.log(JSON.stringify({ fixed: changes.length, changes }, null, 2));
		} else if (changes.length === 0) {
			console.log("skill-issue --fix: nothing to auto-heal (no confident description rewrites).");
		} else {
			console.log(`skill-issue --fix: added a trigger clause to ${changes.length} skill(s):`);
			for (const c of changes) console.log(`  ${c.skill}\n    ${c.file}`);
		}
		// Re-lint for an honest post-fix exit code.
		return lint(loadSkills(path)).some((f) => f.level === "error") ? 1 : 0;
	}

	const report = buildDefaultReport(skills);
	console.log(json ? JSON.stringify(report.json, null, 2) : report.text);
	return report.exitCode;
}

process.exit(main(process.argv));
