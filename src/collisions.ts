// `--collisions` — find skills competing for the same intent.
//
// Two skills collide when their DISTINCTIVE trigger terms overlap heavily:
// install both and, for the shared intent, one silently always wins and the
// other never fires. We measure pairwise Jaccard over each skill's salient
// terms and union the colliding pairs into clusters.
//
// The trap (found by dogfooding on a real 70-skill set): families of skills
// share boilerplate — voice-trigger lines, "proactively suggest", a common
// brand word — and a loose rule chains all of them into one useless mega
// cluster. So we first drop corpus-wide terms (anything present in a large
// share of skills carries no discriminating signal), then require a real
// Jaccard AND ≥2 shared distinctive terms before merging.

import { skillTerms } from "./triggers.ts";
import type { Collision, Skill } from "./types.ts";

// Pairs at or above this Jaccard (over distinctive terms) are colliding.
export const COLLISION_THRESHOLD = 0.4;
// A colliding pair must share at least this many distinctive terms.
const MIN_SHARED = 2;

/** Terms common to many skills carry no signal — compute the corpus boilerplate. */
function corpusCommon(salientSets: Set<string>[]): Set<string> {
	const n = salientSets.length;
	const df = new Map<string, number>();
	for (const s of salientSets) for (const t of s) df.set(t, (df.get(t) ?? 0) + 1);
	const threshold = Math.max(4, Math.ceil(0.15 * n));
	const common = new Set<string>();
	for (const [t, c] of df) if (c >= threshold) common.add(t);
	return common;
}

function jaccard(a: Set<string>, b: Set<string>): { j: number; shared: string[] } {
	if (a.size === 0 || b.size === 0) return { j: 0, shared: [] };
	const shared: string[] = [];
	for (const t of a) if (b.has(t)) shared.push(t);
	const union = a.size + b.size - shared.length;
	return { j: union === 0 ? 0 : shared.length / union, shared };
}

export function findCollisions(skills: Skill[]): Collision[] {
	const terms = skills.map(skillTerms).filter((t) => t.salient.size > 0);
	const n = terms.length;

	// Distinctive terms = salient minus corpus-wide boilerplate.
	const common = corpusCommon(terms.map((t) => t.salient));
	const distinctive = terms.map((t) => {
		const d = new Set<string>();
		for (const x of t.salient) if (!common.has(x)) d.add(x);
		return d;
	});

	// Union-find over colliding pairs.
	const parent = Array.from({ length: n }, (_, i) => i);
	const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x] as number)));
	const edgeJ = new Map<string, number>();
	const pairShared = new Map<string, string[]>();

	for (let i = 0; i < n; i++) {
		for (let k = i + 1; k < n; k++) {
			const { j, shared } = jaccard(distinctive[i] as Set<string>, distinctive[k] as Set<string>);
			if (j >= COLLISION_THRESHOLD && shared.length >= MIN_SHARED) {
				parent[find(i)] = find(k);
				const key = `${i}-${k}`;
				edgeJ.set(key, j);
				pairShared.set(key, shared);
			}
		}
	}

	// Gather members + shared terms + mean edge strength per cluster.
	const clusters = new Map<number, number[]>();
	for (let i = 0; i < n; i++) {
		const r = find(i);
		const arr = clusters.get(r) ?? [];
		arr.push(i);
		clusters.set(r, arr);
	}

	const out: Collision[] = [];
	for (const members of clusters.values()) {
		if (members.length < 2) continue;
		const sharedCount = new Map<string, number>();
		let jSum = 0;
		let edges = 0;
		for (let a = 0; a < members.length; a++) {
			for (let b = a + 1; b < members.length; b++) {
				const lo = Math.min(members[a] as number, members[b] as number);
				const hi = Math.max(members[a] as number, members[b] as number);
				const sh = pairShared.get(`${lo}-${hi}`);
				if (!sh) continue;
				edges++;
				jSum += edgeJ.get(`${lo}-${hi}`) ?? 0;
				for (const t of sh) sharedCount.set(t, (sharedCount.get(t) ?? 0) + 1);
			}
		}
		const shared = [...sharedCount.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t);
		out.push({
			skills: members.map((i) => (terms[i] as (typeof terms)[number]).skill.name).sort(),
			shared,
			strength: edges ? jSum / edges : 0,
		});
	}

	out.sort((a, b) => b.strength - a.strength || b.skills.length - a.skills.length);
	return out;
}
