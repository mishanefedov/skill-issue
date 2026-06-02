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
