import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, readFolded, replaceDescription } from "../src/frontmatter.ts";

const FIX = join(import.meta.dir, "fixtures/skills");

test("parses name and a folded description", () => {
	const fm = parseFrontmatter(readFileSync(join(FIX, "good/SKILL.md"), "utf8"));
	expect(fm.name).toBe("deploy-prod");
	expect(fm.description).toContain("Deploy the application");
	expect(fm.description).toContain("Use when");
	expect(fm.body).toContain("# deploy-prod");
});

test("parses an empty description as empty string", () => {
	const fm = parseFrontmatter(readFileSync(join(FIX, "empty/SKILL.md"), "utf8"));
	expect(fm.name).toBe("broken");
	expect(fm.description).toBe("");
});

test("content without frontmatter yields empty metadata", () => {
	const fm = parseFrontmatter("# just a heading\n\nbody only");
	expect(fm.name).toBe("");
	expect(fm.description).toBe("");
	expect(fm.body).toContain("just a heading");
});

test("readFolded stops at the next top-level key", () => {
	const fm = "description: >\n  line one\n  line two\nname: x\n";
	expect(readFolded(fm, "description")).toBe("line one line two");
});

test("replaceDescription rewrites only the description, keeps the body", () => {
	const src = readFileSync(join(FIX, "no-when/SKILL.md"), "utf8");
	const out = replaceDescription(src, "New text. Use when foo, bar.") as string;
	expect(out).toContain("description: New text. Use when foo, bar.");
	expect(out).toContain("# format-sql");
	expect(parseFrontmatter(out).description).toBe("New text. Use when foo, bar.");
});
