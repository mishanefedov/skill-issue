// Reduce a skill to the terms that actually drive activation, and weight them.
//
// An agent picks a skill by matching the user's request against the skill's
// name + description. Terms in the name or in an explicit "use when …" clause
// are strong intent signals; generic filler ("helps with code", "for tasks")
// is noise. We extract the signal and down-weight the noise.

import type { Skill, SkillTerms } from "./types.ts";

// English function words + agent-boilerplate that carry no activation signal.
const STOPWORDS = new Set([
	"the",
	"a",
	"an",
	"and",
	"or",
	"but",
	"if",
	"then",
	"to",
	"of",
	"in",
	"on",
	"for",
	"with",
	"by",
	"as",
	"at",
	"from",
	"into",
	"your",
	"you",
	"this",
	"that",
	"these",
	"those",
	"it",
	"its",
	"is",
	"are",
	"be",
	"been",
	"being",
	"will",
	"can",
	"may",
	"should",
	"would",
	"could",
	"do",
	"does",
	"did",
	"use",
	"used",
	"using",
	"when",
	"where",
	"what",
	"which",
	"who",
	"how",
	"want",
	"wants",
	"need",
	"needs",
	"user",
	"users",
	"asks",
	"ask",
	"asking",
	"says",
	"say",
	"e.g",
	"eg",
	"ie",
	"etc",
	"any",
	"all",
	"some",
	"via",
	"per",
	"out",
	"up",
	"so",
	"not",
	"no",
	"yes",
	"their",
	"them",
	"they",
	"after",
	"before",
	"also",
]);

// Vague terms that match almost any request — present but not discriminating.
// Used to compute a "generic ratio" for the vagueness check, NOT removed from
// scoring entirely (a request literally about "code" should still match).
const GENERIC = new Set([
	"help",
	"helps",
	"code",
	"coding",
	"task",
	"tasks",
	"thing",
	"things",
	"stuff",
	"work",
	"working",
	"development",
	"dev",
	"tool",
	"tools",
	"file",
	"files",
	"project",
	"projects",
	"general",
	"various",
	"handle",
	"handles",
	"manage",
	"manages",
	"support",
	"supports",
	"feature",
	"features",
	"system",
	"app",
	"application",
	"data",
	"process",
	"various",
	"things",
]);

/** Lowercase, strip punctuation, split, drop stopwords and 1-char tokens. */
export function tokenize(text: string): string[] {
	return (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? [])
		.map((t) => t.replace(/^[.+-]+|[.+-]+$/g, ""))
		.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** True when a term is a generic, low-discrimination word. */
export function isGeneric(term: string): boolean {
	return GENERIC.has(term);
}

/**
 * Parse a "use when …" trigger clause into its phrases. Recognizes the common
 * authoring forms: "Use when X, Y, or Z", "Use this when …", "Trigger when …".
 */
export function parseUseWhen(description: string): string[] {
	const m =
		description.match(/\buse(?:\s+this)?\s+when\b(.*)$/is) ?? description.match(/\btrigger(?:s)?\s+when\b(.*)$/is);
	if (!m) return [];
	const clause = (m[1] as string).split(/(?:^|\s)(?:use|trigger)\b/i)[0] ?? "";
	return clause
		.split(/[,;]| or | and /i)
		.map((s) => s.replace(/["'.]/g, "").trim())
		.filter((s) => s.length > 1)
		.slice(0, 24);
}

/** True when the description has any explicit trigger / "use when" clause. */
export function hasUseWhen(description: string): boolean {
	return /\buse(?:\s+this)?\s+when\b|\btrigger(?:s)?\s+when\b/i.test(description);
}

const NAME_BOOST = 2.5;
const USE_WHEN_BOOST = 2;
const DESC_BASE = 1;

/** Build the weighted term model for one skill. */
export function skillTerms(skill: Skill): SkillTerms {
	const weights = new Map<string, number>();
	const add = (term: string, w: number) => weights.set(term, Math.max(weights.get(term) ?? 0, w));

	for (const t of tokenize(skill.name.replace(/[-_]/g, " "))) add(t, NAME_BOOST);
	for (const t of tokenize(skill.description)) add(t, DESC_BASE);

	const useWhen = parseUseWhen(skill.description);
	for (const phrase of useWhen) for (const t of tokenize(phrase)) add(t, USE_WHEN_BOOST);

	const salient = new Set<string>();
	for (const [term, w] of weights) if (!isGeneric(term) && w >= DESC_BASE) salient.add(term);

	return { skill, weights, salient, useWhen };
}

/** Build term models for a whole set, plus the document frequency of each term. */
export function corpus(skills: Skill[]): { terms: SkillTerms[]; df: Map<string, number> } {
	const terms = skills.map(skillTerms);
	const df = new Map<string, number>();
	for (const st of terms) for (const term of st.weights.keys()) df.set(term, (df.get(term) ?? 0) + 1);
	return { terms, df };
}

/** Inverse document frequency: rare terms across the skill set weigh more. */
export function idf(term: string, df: Map<string, number>, n: number): number {
	return Math.log(1 + n / ((df.get(term) ?? 0) + 0.5));
}
