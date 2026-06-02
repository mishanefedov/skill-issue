// Optional `--llm` judge. No SDK dependency: shell out to a local agent CLI
// (`claude` or `codex`) and ask it to rank the skills for the prompt. Returns
// null on any failure so the caller falls back to the offline heuristic — the
// heuristic stays the zero-dependency default and the network path is opt-in.

import { spawnSync } from "node:child_process";
import type { Simulation } from "./simulate.ts";
import type { Score, Skill } from "./types.ts";

function whichCli(): string | null {
	for (const c of ["claude", "codex"]) {
		const r = spawnSync("which", [c], { encoding: "utf8" });
		if (r.status === 0 && r.stdout.trim()) return c;
	}
	return null;
}

function buildPrompt(skills: Skill[], prompt: string): string {
	const list = skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
	return [
		"You are a coding agent's skill picker. Given a user request and a list of",
		"installed skills (name: description), decide which would fire and how",
		'strongly. Return ONLY JSON: {"scores":[{"skill":"<name>","score":<0..1>}]}',
		"ordered best first. No prose.",
		"",
		`User request: ${prompt}`,
		"",
		"Skills:",
		list,
	].join("\n");
}

/** Try to score via a local agent CLI. Returns null if unavailable/unparseable. */
export function llmJudge(skills: Skill[], prompt: string): Simulation | null {
	const cli = whichCli();
	if (!cli) return null;
	const args = cli === "claude" ? ["-p", buildPrompt(skills, prompt)] : ["exec", buildPrompt(skills, prompt)];
	const r = spawnSync(cli, args, { encoding: "utf8", timeout: 60_000 });
	if (r.status !== 0 || !r.stdout) return null;

	const m = r.stdout.match(/\{[\s\S]*\}/);
	if (!m) return null;
	let parsed: { scores?: Array<{ skill?: string; score?: number }> };
	try {
		parsed = JSON.parse(m[0]);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed.scores)) return null;

	const byName = new Map(skills.map((s) => [s.name, s.file]));
	const scores: Score[] = parsed.scores
		.filter((s) => s.skill && byName.has(s.skill))
		.map((s) => ({
			skill: s.skill as string,
			file: byName.get(s.skill as string) ?? "",
			score: Math.max(0, Math.min(1, Number(s.score) || 0)),
			matched: [],
		}));
	if (scores.length === 0) return null;

	scores.sort((a, b) => b.score - a.score);
	const top = scores[0]?.score ?? 0;
	const second = scores[1]?.score ?? 0;
	return { prompt, scores, margin: top - second, noFire: top < 0.3, engine: "llm" };
}
