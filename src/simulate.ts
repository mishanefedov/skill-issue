// `--why "<prompt>"` — predict which skill the agent would fire and why.
//
// Heuristic and offline by default: score every skill against the prompt by how
// much of the prompt's salient, rarity-weighted vocabulary the skill's terms
// cover. A low top score means "no skill would reliably fire" — itself the
// diagnosis. `--llm` swaps in a real model judge (see llmJudge), falling back
// to the heuristic if no model is reachable.

import { corpus, idf, tokenize } from "./triggers.ts";
import type { Score, Skill } from "./types.ts";

export interface Simulation {
	prompt: string;
	scores: Score[]; // sorted desc
	/** Margin between the top two scores (ambiguity signal). */
	margin: number;
	/** True when even the top score is too low to count as a confident fire. */
	noFire: boolean;
	engine: "heuristic" | "llm";
}

// Below this, the top skill is unlikely to fire reliably for the prompt.
export const FIRE_THRESHOLD = 0.3;
// Top-two gap under this means the two skills collide on this intent.
export const AMBIGUOUS_MARGIN = 0.08;

/** Score one prompt against a set of skills with the offline heuristic. */
export function simulate(skills: Skill[], prompt: string): Simulation {
	const { terms, df } = corpus(skills);
	const n = Math.max(skills.length, 1);
	const promptTerms = [...new Set(tokenize(prompt))];

	// Max achievable mass = every prompt term present at unit weight, by rarity.
	const denom = promptTerms.reduce((s, t) => s + idf(t, df, n), 0) || 1;

	const scores: Score[] = terms.map((st) => {
		let raw = 0;
		const matched: string[] = [];
		for (const t of promptTerms) {
			const w = st.weights.get(t);
			if (w) {
				raw += w * idf(t, df, n);
				matched.push(t);
			}
		}
		return {
			skill: st.skill.name,
			file: st.skill.file,
			score: Math.min(1, raw / denom),
			matched,
		};
	});

	scores.sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill));
	const top = scores[0]?.score ?? 0;
	const second = scores[1]?.score ?? 0;
	return {
		prompt,
		scores,
		margin: top - second,
		noFire: top < FIRE_THRESHOLD,
		engine: "heuristic",
	};
}

/** Prompt terms a given skill does NOT cover, ranked by rarity (most useful first). */
export function missingTerms(skills: Skill[], prompt: string, skillName: string): string[] {
	const { terms, df } = corpus(skills);
	const n = Math.max(skills.length, 1);
	const target = terms.find((t) => t.skill.name === skillName);
	if (!target) return [];
	const promptTerms = [...new Set(tokenize(prompt))];
	return promptTerms.filter((t) => !target.weights.has(t)).sort((a, b) => idf(b, df, n) - idf(a, df, n));
}
