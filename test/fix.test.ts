import { afterAll, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkills } from "../src/discover.ts";
import { applyFixes } from "../src/fix.ts";
import { hasUseWhen } from "../src/triggers.ts";

const FIX = join(import.meta.dir, "fixtures/skills");
const tmps: string[] = [];

afterAll(() => {
	for (const d of tmps) rmSync(d, { recursive: true, force: true });
});

test("dry run targets only confident, trigger-clause-less skills", () => {
	const changes = applyFixes(loadSkills(FIX), false).changes;
	const names = changes.map((c) => c.skill);
	expect(names).toContain("format-sql"); // specific, no use-when → fixable
	expect(names).not.toContain("deploy-prod"); // already has a use-when clause
	expect(names).not.toContain("broken"); // empty description → not confident
	expect(names).not.toContain("helper"); // too few triggers to be confident
});

test("the appended clause is grounded in the skill's own vocabulary", () => {
	const change = applyFixes(loadSkills(FIX), false).changes.find((c) => c.skill === "format-sql");
	expect(change?.to).toContain("Use when");
	expect(change?.to.toLowerCase()).toContain("sql");
});

test("writing the fix makes the skill pass the use-when check", () => {
	const dir = mkdtempSync(join(tmpdir(), "skill-issue-fix-"));
	tmps.push(dir);
	cpSync(join(FIX, "no-when"), join(dir, "no-when"), { recursive: true });

	const before = loadSkills(dir);
	expect(hasUseWhen(before[0]?.description ?? "")).toBe(false);

	applyFixes(before, true);

	const after = readFileSync(join(dir, "no-when/SKILL.md"), "utf8");
	expect(hasUseWhen(after)).toBe(true);
});
