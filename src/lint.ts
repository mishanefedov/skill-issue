// `lint` (default) — grade each skill on whether it will reliably fire.
//
// Conservative: only genuinely broken metadata (empty or duplicated
// description) is an error. Everything that merely makes a skill less likely to
// fire is a graded warning, because a linter that cries wolf on a big skill set
// gets uninstalled.

import { hasUseWhen, isGeneric, skillTerms, tokenize } from "./triggers.ts";
import type { Finding, Skill } from "./types.ts";

// A description shorter than this (in salient terms) can't match varied phrasing.
const MIN_SALIENT = 3;
// Description token thresholds: too thin to match, or so heavy it taxes context.
const MIN_DESC_TOKENS = 6;
const MAX_DESC_TOKENS = 120;
// Above this share of generic terms, the description barely discriminates.
const GENERIC_RATIO = 0.6;

function norm(s: string): string {
	return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function lint(skills: Skill[]): Finding[] {
	const findings: Finding[] = [];

	// Duplicate-metadata detection across the set.
	const byDesc = new Map<string, string[]>();
	for (const s of skills) {
		if (!s.description) continue;
		const key = norm(s.description);
		const arr = byDesc.get(key) ?? [];
		arr.push(s.name);
		byDesc.set(key, arr);
	}

	for (const s of skills) {
		const desc = s.description.trim();
		if (!desc) {
			findings.push({
				skill: s.name,
				file: s.file,
				level: "error",
				rule: "empty-description",
				reason: "no description — the agent has nothing to match on, so it can never fire this skill",
				suggestion: 'add a description: "<what it does>. Use when <triggers>."',
			});
			continue;
		}

		const dupes = (byDesc.get(norm(desc)) ?? []).filter((n) => n !== s.name);
		if (dupes.length > 0) {
			findings.push({
				skill: s.name,
				file: s.file,
				level: "error",
				rule: "duplicate-description",
				reason: `identical description to: ${dupes.join(", ")} — the picker can't tell them apart`,
				suggestion: "differentiate the descriptions so each names its distinct intent",
			});
		}

		const descTokens = tokenize(desc);
		const st = skillTerms(s);

		if (!hasUseWhen(desc)) {
			findings.push({
				skill: s.name,
				file: s.file,
				level: "warn",
				rule: "no-use-when",
				reason: 'no "use when …" trigger clause — the agent has to guess when this applies',
				suggestion: "append: Use when <the phrases a user would actually type>",
			});
		}

		if (descTokens.length < MIN_DESC_TOKENS) {
			findings.push({
				skill: s.name,
				file: s.file,
				level: "warn",
				rule: "too-thin",
				reason: `description is only ${descTokens.length} content word(s) — too thin to match varied phrasing`,
				suggestion: "name concrete triggers, tools, and outcomes a request would mention",
			});
		} else if (descTokens.length > MAX_DESC_TOKENS) {
			findings.push({
				skill: s.name,
				file: s.file,
				level: "warn",
				rule: "too-heavy",
				reason: `description is ${descTokens.length} words — it taxes every session's always-on context`,
				suggestion: "tighten to the trigger + outcome; move detail into the body",
			});
		}

		if (st.salient.size < MIN_SALIENT) {
			findings.push({
				skill: s.name,
				file: s.file,
				level: "warn",
				rule: "vague",
				reason: `only ${st.salient.size} distinct, specific trigger term(s) — too generic to win against a focused skill`,
				suggestion: 'replace filler ("helps with code") with the specific task, tool, or noun',
			});
		} else {
			const genericCount = descTokens.filter(isGeneric).length;
			if (descTokens.length > 0 && genericCount / descTokens.length >= GENERIC_RATIO) {
				findings.push({
					skill: s.name,
					file: s.file,
					level: "warn",
					rule: "generic",
					reason: "mostly generic words — matches almost anything, so it loses to more specific skills",
					suggestion: "lead with the distinctive intent, not generic verbs",
				});
			}
		}

		const nameTokens = new Set(tokenize(s.name.replace(/[-_]/g, " ")));
		if (nameTokens.size > 0 && descTokens.length > 0 && descTokens.every((t) => nameTokens.has(t))) {
			findings.push({
				skill: s.name,
				file: s.file,
				level: "warn",
				rule: "restates-name",
				reason: "description only restates the name — adds no new trigger vocabulary",
				suggestion: "describe what it does and when to use it, beyond the name",
			});
		}
	}

	return findings;
}

/** Map a skill's findings to a letter grade. */
export function grade(findings: Finding[]): "A" | "B" | "C" | "D" | "F" {
	if (findings.some((f) => f.level === "error")) return "F";
	const warns = findings.filter((f) => f.level === "warn").length;
	if (warns === 0) return "A";
	if (warns === 1) return "B";
	if (warns === 2) return "C";
	return "D";
}
