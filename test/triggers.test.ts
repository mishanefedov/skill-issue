import { expect, test } from "bun:test";
import { hasUseWhen, isGeneric, parseUseWhen, skillTerms, tokenize } from "../src/triggers.ts";
import type { Skill } from "../src/types.ts";

test("tokenize drops stopwords and 1-char tokens", () => {
	const t = tokenize("Deploy the app to the production server");
	expect(t).toContain("deploy");
	expect(t).toContain("production");
	expect(t).not.toContain("the");
	expect(t).not.toContain("to");
});

test("isGeneric flags filler words", () => {
	expect(isGeneric("code")).toBe(true);
	expect(isGeneric("help")).toBe(true);
	expect(isGeneric("sqlfluff")).toBe(false);
});

test("hasUseWhen and parseUseWhen read the trigger clause", () => {
	const d = "Does a thing. Use when deploying to prod, shipping a release, or rolling back.";
	expect(hasUseWhen(d)).toBe(true);
	const phrases = parseUseWhen(d);
	expect(phrases.length).toBeGreaterThanOrEqual(3);
	expect(phrases.join(" ")).toContain("deploying to prod");
});

test("hasUseWhen is false without a clause", () => {
	expect(hasUseWhen("Formats SQL files with sqlfluff.")).toBe(false);
});

test("skillTerms boosts name and use-when terms above body prose", () => {
	const skill: Skill = {
		name: "deploy-prod",
		file: "x",
		description: "Generic words here. Use when shipping a release.",
		body: "",
	};
	const st = skillTerms(skill);
	// name term outweighs a plain description term
	expect(st.weights.get("deploy") ?? 0).toBeGreaterThan(st.weights.get("words") ?? 0);
	// use-when term ("release") outweighs a plain description term
	expect(st.weights.get("release") ?? 0).toBeGreaterThan(st.weights.get("words") ?? 0);
	expect(st.salient.has("deploy")).toBe(true);
});
