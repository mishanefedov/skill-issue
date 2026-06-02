import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SKILLS = join(import.meta.dir, "fixtures/skills");
const COLLIDE = join(import.meta.dir, "fixtures/collisions");

function run(args: string[]) {
	return spawnSync("bun", ["run", "src/cli.ts", ...args], { cwd: ROOT, encoding: "utf8" });
}

test("default run exits 1 when a skill has an error-level defect", () => {
	const r = run([SKILLS]);
	expect(r.status).toBe(1);
	expect(r.stdout).toContain("broken");
	expect(r.stdout).toContain("collision");
});

test("--json emits a parseable report", () => {
	const r = run([SKILLS, "--json"]);
	const data = JSON.parse(r.stdout);
	expect(data.errors).toBeGreaterThanOrEqual(1);
	expect(Array.isArray(data.grades)).toBe(true);
});

test("--why prints the winning skill", () => {
	const r = run([SKILLS, "--why", "deploy to prod"]);
	expect(r.status).toBe(0);
	expect(r.stdout).toContain("deploy-prod");
	expect(r.stdout).toContain("would fire");
});

test("--collisions reports the competing cluster and exits 0", () => {
	const r = run([COLLIDE, "--collisions"]);
	expect(r.status).toBe(0);
	expect(r.stdout.toLowerCase()).toContain("collision");
	expect(r.stdout).toContain("code-review");
});

test("--help exits 0", () => {
	const r = run(["--help"]);
	expect(r.status).toBe(0);
	expect(r.stdout).toContain("find out why your skill won't fire");
});
