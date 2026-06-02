// Core data shapes shared across the pipeline.

/** A single skill's always-on metadata + body, as the agent loads it. */
export interface Skill {
	/** Skill name (frontmatter `name:`, else the directory name). */
	name: string;
	/** Absolute or relative path to the SKILL.md / agent markdown file. */
	file: string;
	/** The `description:` value — the always-on text the picker reads. */
	description: string;
	/** Everything after the frontmatter (loads only when the skill fires). */
	body: string;
}

/** A skill reduced to the terms that drive activation. */
export interface SkillTerms {
	skill: Skill;
	/** term -> weight (name / use-when terms weigh more than body description). */
	weights: Map<string, number>;
	/** The salient (non-generic) terms, for collision + vagueness checks. */
	salient: Set<string>;
	/** Trigger phrases parsed from a "use when …" clause, if any. */
	useWhen: string[];
}

export type Level = "error" | "warn" | "ok";

/** One activation-quality finding about one skill. */
export interface Finding {
	skill: string;
	file: string;
	level: Level;
	/** Stable rule id, e.g. "empty-description", "no-use-when", "vague". */
	rule: string;
	reason: string;
	/** A concrete suggested fix, when one exists. */
	suggestion?: string;
}

/** One skill's score for a given prompt (the `--why` simulator). */
export interface Score {
	skill: string;
	file: string;
	/** 0..1 fraction of the prompt's salient, rarity-weighted terms covered. */
	score: number;
	/** Prompt terms this skill matched on (for transparency). */
	matched: string[];
}

/** A cluster of skills competing for the same intent. */
export interface Collision {
	/** Skill names in the cluster. */
	skills: string[];
	/** The trigger terms they share. */
	shared: string[];
	/** Mean pairwise Jaccard within the cluster (0..1). */
	strength: number;
}

/** Result of a fix rewrite on one file. */
export interface FixChange {
	skill: string;
	file: string;
	from: string;
	to: string;
}

/** A rendered report. */
export interface Report {
	text: string;
	json: object;
	exitCode: number;
}
