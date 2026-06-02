import { expect, test } from "bun:test";
import { join } from "node:path";
import { loadSkills } from "../src/discover.ts";
import { missingTerms, simulate } from "../src/simulate.ts";

const FIX = join(import.meta.dir, "fixtures/skills");

test("the matching skill wins and is scored as firing", () => {
	const sim = simulate(loadSkills(FIX), "deploy to prod");
	expect(sim.scores[0]?.skill).toBe("deploy-prod");
	expect(sim.scores[0]?.score).toBeGreaterThan(0.5);
	expect(sim.noFire).toBe(false);
	expect(sim.engine).toBe("heuristic");
});

test("an off-topic prompt fires no skill", () => {
	const sim = simulate(loadSkills(FIX), "translate this paragraph into french");
	expect(sim.noFire).toBe(true);
});

test("missingTerms names the prompt words a skill lacks", () => {
	const miss = missingTerms(loadSkills(FIX), "deploy to prod", "format-sql");
	expect(miss).toContain("deploy");
	expect(miss).toContain("prod");
});

test("a matched skill reports which prompt terms it matched", () => {
	const sim = simulate(loadSkills(FIX), "deploy to prod");
	const top = sim.scores[0];
	expect(top?.matched).toContain("deploy");
	expect(top?.matched).toContain("prod");
});
