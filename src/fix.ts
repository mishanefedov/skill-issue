// `--fix` — conservatively repair the most common, safest activation defect:
// a description with no "use when …" trigger clause. We append one built from
// the skill's own existing trigger vocabulary (name + description), so the fix
// is grounded in what the skill already claims and never invents capability.
//
// It only touches high-confidence cases (missing clause + ≥2 derived triggers)
// and rewrites just the description field, leaving the body untouched.

import { readFileSync, writeFileSync } from "node:fs";
import { replaceDescription } from "./frontmatter.ts";
import { hasUseWhen, isGeneric, skillTerms, tokenize } from "./triggers.ts";
import type { FixChange, Skill } from "./types.ts";

const MAX_TRIGGERS = 5;

/** Ordered, deduped trigger terms grounded in the skill's name + description. */
function deriveTriggers(skill: Skill): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	const push = (t: string) => {
		if (!seen.has(t) && !isGeneric(t)) {
			seen.add(t);
			out.push(t);
		}
	};
	for (const t of tokenize(skill.name.replace(/[-_]/g, " "))) push(t);
	for (const t of skillTerms(skill).salient) push(t);
	return out.slice(0, MAX_TRIGGERS);
}

export interface FixResult {
	changes: FixChange[];
}

/** Compute (and optionally write) description fixes. `write:false` is a dry run. */
export function applyFixes(skills: Skill[], write: boolean): FixResult {
	const changes: FixChange[] = [];
	for (const s of skills) {
		const desc = s.description.trim();
		if (!desc || hasUseWhen(desc)) continue;
		const triggers = deriveTriggers(s);
		if (triggers.length < 2) continue; // not confident enough to rewrite

		const tail = `Use when ${triggers.join(", ")}.`;
		const next = /[.!?]$/.test(desc) ? `${desc} ${tail}` : `${desc}. ${tail}`;

		let content: string;
		try {
			content = readFileSync(s.file, "utf8");
		} catch {
			continue;
		}
		const updated = replaceDescription(content, next);
		if (!updated || updated === content) continue;

		if (write) writeFileSync(s.file, updated);
		changes.push({ skill: s.name, file: s.file, from: desc, to: next });
	}
	return { changes };
}
