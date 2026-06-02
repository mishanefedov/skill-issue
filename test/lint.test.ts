import { expect, test } from "bun:test";
import { join } from "node:path";
import { loadSkills } from "../src/discover.ts";
import { grade, lint } from "../src/lint.ts";

const FIX = join(import.meta.dir, "fixtures/skills");

function rulesFor(skill: string) {
	return lint(loadSkills(FIX))
		.filter((f) => f.skill === skill)
		.map((f) => f.rule);
}

test("a clear skill with triggers has no findings (grade A)", () => {
	const findings = lint(loadSkills(FIX)).filter((f) => f.skill === "deploy-prod");
	expect(findings).toHaveLength(0);
	expect(grade(findings)).toBe("A");
});

test("an empty description is an error (grade F)", () => {
	const findings = lint(loadSkills(FIX)).filter((f) => f.skill === "broken");
	expect(findings.some((f) => f.rule === "empty-description" && f.level === "error")).toBe(true);
	expect(grade(findings)).toBe("F");
});

test("a vague description warns on vagueness and missing trigger clause", () => {
	const rules = rulesFor("helper");
	expect(rules).toContain("vague");
	expect(rules).toContain("no-use-when");
	expect(rules).not.toContain("empty-description");
});

test("a specific description with no trigger clause warns only on no-use-when", () => {
	const findings = lint(loadSkills(FIX)).filter((f) => f.skill === "format-sql");
	expect(findings.map((f) => f.rule)).toEqual(["no-use-when"]);
	expect(grade(findings)).toBe("B");
});

test("every finding carries a concrete suggestion", () => {
	for (const f of lint(loadSkills(FIX))) {
		expect(typeof f.suggestion).toBe("string");
		expect((f.suggestion ?? "").length).toBeGreaterThan(0);
	}
});
