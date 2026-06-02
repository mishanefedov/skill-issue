// Render the pipeline's findings to a human report or machine JSON.

import { findCollisions } from "./collisions.ts";
import { grade, lint } from "./lint.ts";
import { llmJudge } from "./llm.ts";
import { AMBIGUOUS_MARGIN, missingTerms, simulate } from "./simulate.ts";
import type { Collision, Finding, Report, Skill } from "./types.ts";

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const red = (s: string) => (COLOR ? `\x1b[31m${s}\x1b[0m` : s);
const yellow = (s: string) => (COLOR ? `\x1b[33m${s}\x1b[0m` : s);
const green = (s: string) => (COLOR ? `\x1b[32m${s}\x1b[0m` : s);
const dim = (s: string) => (COLOR ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s: string) => (COLOR ? `\x1b[1m${s}\x1b[0m` : s);

function gradeColor(g: string): string {
	if (g === "A") return green(g);
	if (g === "F") return red(g);
	return yellow(g);
}

/** `lint` (and the default run) — per-skill activation grades. */
export function buildLintReport(skills: Skill[], findings: Finding[]): Report {
	const bySkill = new Map<string, Finding[]>();
	for (const s of skills) bySkill.set(s.name, []);
	for (const f of findings) (bySkill.get(f.skill) ?? []).push(f);

	const errors = findings.filter((f) => f.level === "error").length;
	const warns = findings.filter((f) => f.level === "warn").length;

	const lines: string[] = [];
	for (const [name, fs] of bySkill) {
		const g = grade(fs);
		if (fs.length === 0) {
			lines.push(`${gradeColor(g)}  ${name}  ${green("✓ will fire on its triggers")}`);
			continue;
		}
		lines.push(`${gradeColor(g)}  ${bold(name)}`);
		for (const f of fs) {
			const mark = f.level === "error" ? red("✗") : yellow("!");
			lines.push(`     ${mark} ${f.reason}`);
			if (f.suggestion) lines.push(`       ${green(`→ ${f.suggestion}`)}`);
		}
	}

	const summary = `\n${skills.length} skills · ${errors ? red(`${errors} error`) : green("0 errors")} · ${yellow(`${warns} warning`)}`;
	lines.push(summary);

	return {
		text: lines.join("\n"),
		json: {
			skills: skills.length,
			errors,
			warnings: warns,
			grades: [...bySkill].map(([name, fs]) => ({
				skill: name,
				grade: grade(fs),
				findings: fs.map((f) => ({ rule: f.rule, level: f.level, reason: f.reason, suggestion: f.suggestion ?? null })),
			})),
		},
		exitCode: errors > 0 ? 1 : 0,
	};
}

/** `--why "<prompt>"` — which skill fires for a prompt, and why. */
export function buildWhyReport(
	skills: Skill[],
	prompt: string,
	opts: { useLlm?: boolean; focusSkill?: string } = {},
): Report {
	const focusSkill = opts.focusSkill;
	const sim = (opts.useLlm && llmJudge(skills, prompt)) || simulate(skills, prompt);
	const lines: string[] = [];
	const engineNote =
		opts.useLlm && sim.engine === "heuristic" ? dim("  (no agent CLI found — using offline heuristic)") : "";
	lines.push(`${dim(`prompt [${sim.engine}]:`)} ${bold(prompt)}${engineNote}`);

	const top = sim.scores.slice(0, 8);
	top.forEach((s, i) => {
		const pct = s.score.toFixed(2);
		let tag = "";
		if (i === 0 && !sim.noFire) tag = green("  ← would fire");
		if (i === 0 && sim.noFire) tag = red("  ← too weak to fire reliably");
		if (i === 1 && sim.margin < AMBIGUOUS_MARGIN && !sim.noFire)
			tag = yellow(`  (margin ${sim.margin.toFixed(2)} — ambiguous, likely collision)`);
		const matched = s.matched.length ? dim(`  [${s.matched.join(" ")}]`) : dim("  [no terms matched]");
		lines.push(`  ${String(i + 1).padStart(2)}. ${s.skill.padEnd(22)} ${pct}${matched}${tag}`);
	});

	if (sim.noFire) {
		lines.push(
			`\n${red("no skill reliably fires")} for this prompt — the best match is weak. If one should have fired, its description is missing the prompt's vocabulary.`,
		);
	}

	const focus = focusSkill;
	if (focus) {
		const miss = missingTerms(skills, prompt, focus);
		const rank = sim.scores.findIndex((s) => s.skill === focus);
		lines.push(`\n${bold(focus)} ranked #${rank + 1} (${(sim.scores[rank]?.score ?? 0).toFixed(2)}).`);
		if (miss.length) lines.push(green(`→ add these prompt terms to its description: ${miss.join(", ")}`));
	}

	return {
		text: lines.join("\n"),
		json: { prompt, engine: sim.engine, noFire: sim.noFire, margin: sim.margin, scores: sim.scores },
		exitCode: 0,
	};
}

/** `--collisions` — clusters of skills that fight for the same intent. */
export function buildCollisionsReport(skills: Skill[], collisions: Collision[]): Report {
	const lines: string[] = [];
	if (collisions.length === 0) {
		lines.push(green(`✓ no collisions — ${skills.length} skills have distinct trigger vocabularies`));
	} else {
		lines.push(
			`${yellow(`${collisions.length} collision cluster(s)`)} — within each, one skill silently wins the shared intent and the others never fire:\n`,
		);
		for (const c of collisions) {
			lines.push(`  ${bold(c.skills.join(" ⇄ "))}  ${dim(`(overlap ${(c.strength * 100).toFixed(0)}%)`)}`);
			lines.push(`     ${dim("shared triggers:")} ${c.shared.slice(0, 10).join(", ")}`);
			lines.push(`     ${green("→ make each description name what makes it distinct, or merge them")}`);
		}
	}
	return {
		text: lines.join("\n"),
		json: { skills: skills.length, collisions },
		exitCode: 0,
	};
}

/** Default run: lint, with a one-line collisions summary appended. */
export function buildDefaultReport(skills: Skill[]): Report {
	const findings = lint(skills);
	const base = buildLintReport(skills, findings);
	const collisions = findCollisions(skills);
	const note = collisions.length
		? `${yellow(`${collisions.length} collision cluster(s)`)} found — run ${bold("--collisions")} to see which skills shadow each other.`
		: green("no skill collisions.");
	return {
		text: `${base.text}\n${note}`,
		json: { ...(base.json as object), collisions: collisions.length },
		exitCode: base.exitCode,
	};
}
