import { expect, test } from "bun:test";
import { join } from "node:path";
import { findCollisions } from "../src/collisions.ts";
import { loadSkills } from "../src/discover.ts";

const FIX = join(import.meta.dir, "fixtures/collisions");

test("two skills competing for the same intent are clustered", () => {
	const collisions = findCollisions(loadSkills(FIX));
	const cluster = collisions.find((c) => c.skills.includes("code-review") && c.skills.includes("pr-audit"));
	expect(cluster).toBeDefined();
	expect(cluster?.shared).toContain("review");
	expect(cluster?.strength).toBeGreaterThan(0.33);
});

test("an unrelated skill is not pulled into the cluster", () => {
	const collisions = findCollisions(loadSkills(FIX));
	for (const c of collisions) {
		if (c.skills.includes("code-review")) expect(c.skills).not.toContain("changelog");
	}
});

test("a set of distinct skills produces no collisions", () => {
	const collisions = findCollisions(loadSkills(join(import.meta.dir, "fixtures/skills")));
	expect(collisions).toHaveLength(0);
});

test("skills that share only boilerplate do NOT chain into a mega-cluster", () => {
	// Regression: 5 skills with distinct intents but identical voice-trigger /
	// "proactively suggest" boilerplate must not be merged on that shared filler.
	const collisions = findCollisions(loadSkills(join(import.meta.dir, "fixtures/boilerplate")));
	expect(collisions).toHaveLength(0);
});
