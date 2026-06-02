#!/usr/bin/env node
// @bun

// src/cli.ts
import { existsSync } from "fs";

// src/triggers.ts
var STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "then",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "by",
  "as",
  "at",
  "from",
  "into",
  "your",
  "you",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "is",
  "are",
  "be",
  "been",
  "being",
  "will",
  "can",
  "may",
  "should",
  "would",
  "could",
  "do",
  "does",
  "did",
  "use",
  "used",
  "using",
  "when",
  "where",
  "what",
  "which",
  "who",
  "how",
  "want",
  "wants",
  "need",
  "needs",
  "user",
  "users",
  "asks",
  "ask",
  "asking",
  "says",
  "say",
  "e.g",
  "eg",
  "ie",
  "etc",
  "any",
  "all",
  "some",
  "via",
  "per",
  "out",
  "up",
  "so",
  "not",
  "no",
  "yes",
  "their",
  "them",
  "they",
  "after",
  "before",
  "also"
]);
var GENERIC = new Set([
  "help",
  "helps",
  "code",
  "coding",
  "task",
  "tasks",
  "thing",
  "things",
  "stuff",
  "work",
  "working",
  "development",
  "dev",
  "tool",
  "tools",
  "file",
  "files",
  "project",
  "projects",
  "general",
  "various",
  "handle",
  "handles",
  "manage",
  "manages",
  "support",
  "supports",
  "feature",
  "features",
  "system",
  "app",
  "application",
  "data",
  "process",
  "various",
  "things"
]);
function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? []).map((t) => t.replace(/^[.+-]+|[.+-]+$/g, "")).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}
function isGeneric(term) {
  return GENERIC.has(term);
}
function parseUseWhen(description) {
  const m = description.match(/\buse(?:\s+this)?\s+when\b(.*)$/is) ?? description.match(/\btrigger(?:s)?\s+when\b(.*)$/is);
  if (!m)
    return [];
  const clause = m[1].split(/(?:^|\s)(?:use|trigger)\b/i)[0] ?? "";
  return clause.split(/[,;]| or | and /i).map((s) => s.replace(/["'.]/g, "").trim()).filter((s) => s.length > 1).slice(0, 24);
}
function hasUseWhen(description) {
  return /\buse(?:\s+this)?\s+when\b|\btrigger(?:s)?\s+when\b/i.test(description);
}
var NAME_BOOST = 2.5;
var USE_WHEN_BOOST = 2;
var DESC_BASE = 1;
function skillTerms(skill) {
  const weights = new Map;
  const add = (term, w) => weights.set(term, Math.max(weights.get(term) ?? 0, w));
  for (const t of tokenize(skill.name.replace(/[-_]/g, " ")))
    add(t, NAME_BOOST);
  for (const t of tokenize(skill.description))
    add(t, DESC_BASE);
  const useWhen = parseUseWhen(skill.description);
  for (const phrase of useWhen)
    for (const t of tokenize(phrase))
      add(t, USE_WHEN_BOOST);
  const salient = new Set;
  for (const [term, w] of weights)
    if (!isGeneric(term) && w >= DESC_BASE)
      salient.add(term);
  return { skill, weights, salient, useWhen };
}
function corpus(skills) {
  const terms = skills.map(skillTerms);
  const df = new Map;
  for (const st of terms)
    for (const term of st.weights.keys())
      df.set(term, (df.get(term) ?? 0) + 1);
  return { terms, df };
}
function idf(term, df, n) {
  return Math.log(1 + n / ((df.get(term) ?? 0) + 0.5));
}

// src/collisions.ts
var COLLISION_THRESHOLD = 0.4;
var MIN_SHARED = 2;
function corpusCommon(salientSets) {
  const n = salientSets.length;
  const df = new Map;
  for (const s of salientSets)
    for (const t of s)
      df.set(t, (df.get(t) ?? 0) + 1);
  const threshold = Math.max(4, Math.ceil(0.15 * n));
  const common = new Set;
  for (const [t, c] of df)
    if (c >= threshold)
      common.add(t);
  return common;
}
function jaccard(a, b) {
  if (a.size === 0 || b.size === 0)
    return { j: 0, shared: [] };
  const shared = [];
  for (const t of a)
    if (b.has(t))
      shared.push(t);
  const union = a.size + b.size - shared.length;
  return { j: union === 0 ? 0 : shared.length / union, shared };
}
function findCollisions(skills) {
  const terms = skills.map(skillTerms).filter((t) => t.salient.size > 0);
  const n = terms.length;
  const common = corpusCommon(terms.map((t) => t.salient));
  const distinctive = terms.map((t) => {
    const d = new Set;
    for (const x of t.salient)
      if (!common.has(x))
        d.add(x);
    return d;
  });
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => parent[x] === x ? x : parent[x] = find(parent[x]);
  const edgeJ = new Map;
  const pairShared = new Map;
  for (let i = 0;i < n; i++) {
    for (let k = i + 1;k < n; k++) {
      const { j, shared } = jaccard(distinctive[i], distinctive[k]);
      if (j >= COLLISION_THRESHOLD && shared.length >= MIN_SHARED) {
        parent[find(i)] = find(k);
        const key = `${i}-${k}`;
        edgeJ.set(key, j);
        pairShared.set(key, shared);
      }
    }
  }
  const clusters = new Map;
  for (let i = 0;i < n; i++) {
    const r = find(i);
    const arr = clusters.get(r) ?? [];
    arr.push(i);
    clusters.set(r, arr);
  }
  const out = [];
  for (const members of clusters.values()) {
    if (members.length < 2)
      continue;
    const sharedCount = new Map;
    let jSum = 0;
    let edges = 0;
    for (let a = 0;a < members.length; a++) {
      for (let b = a + 1;b < members.length; b++) {
        const lo = Math.min(members[a], members[b]);
        const hi = Math.max(members[a], members[b]);
        const sh = pairShared.get(`${lo}-${hi}`);
        if (!sh)
          continue;
        edges++;
        jSum += edgeJ.get(`${lo}-${hi}`) ?? 0;
        for (const t of sh)
          sharedCount.set(t, (sharedCount.get(t) ?? 0) + 1);
      }
    }
    const shared = [...sharedCount.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t);
    out.push({
      skills: members.map((i) => terms[i].skill.name).sort(),
      shared,
      strength: edges ? jSum / edges : 0
    });
  }
  out.sort((a, b) => b.strength - a.strength || b.skills.length - a.skills.length);
  return out;
}

// src/discover.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// src/frontmatter.ts
function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m)
    return { name: "", description: "", body: content };
  const fm = m[1];
  const body = m[2] ?? "";
  const name = (fm.match(/^name:\s*(.+)$/m)?.[1] ?? "").trim();
  return { name, description: readFolded(fm, "description"), body };
}
function readFolded(fm, key) {
  const dm = fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!dm)
    return "";
  const start = (dm.index ?? 0) + dm[0].length;
  const rest = fm.slice(start).split(`
`);
  const head = (dm[1] ?? "").replace(/^[>|]\s*/, "").trim();
  const cont = [];
  for (const line of rest) {
    if (/^\S/.test(line) && /^[\w-]+:/.test(line))
      break;
    cont.push(line.trim());
  }
  return [head, ...cont].join(" ").trim();
}
function replaceDescription(content, next) {
  const m = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/);
  if (!m)
    return null;
  const [, open, fm, close, body] = m;
  const lines = fm.split(`
`);
  const out = [];
  let i = 0;
  let replaced = false;
  while (i < lines.length) {
    const line = lines[i];
    if (/^description:/.test(line)) {
      out.push(`description: ${next}`);
      replaced = true;
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (/^\S/.test(l) && /^[\w-]+:/.test(l))
          break;
        i++;
      }
      continue;
    }
    out.push(line);
    i++;
  }
  if (!replaced)
    out.unshift(`description: ${next}`);
  return `${open}${out.join(`
`)}${close}${body}`;
}

// src/discover.ts
var SKIP_DIRS = new Set(["node_modules", ".git", ".cursor", ".opencode", ".codex", "dist", "build"]);
var MAX_DEPTH = 4;
function walk(dir, depth, out) {
  if (depth > MAX_DEPTH)
    return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  const inAgentsDir = dir.split(/[\\/]/).pop() === "agents";
  for (const e of entries) {
    const full = join(dir, e);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      if (SKIP_DIRS.has(e) || e.startsWith("."))
        continue;
      walk(full, depth + 1, out);
    } else if (e === "SKILL.md") {
      const name = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;
      out.push({ name, file: full, depth });
    } else if (inAgentsDir && e.endsWith(".md") && e !== "AGENTS.md" && e !== "README.md") {
      out.push({ name: e.replace(/\.md$/, ""), file: full, depth });
    }
  }
}
function loadSkills(root) {
  const candidates = [];
  let isDir = false;
  try {
    isDir = statSync(root).isDirectory();
  } catch {
    return [];
  }
  if (!isDir)
    return [];
  if (readdirSync(root).includes("SKILL.md")) {
    candidates.push({
      name: root.split(/[\\/]/).filter(Boolean).pop() ?? root,
      file: join(root, "SKILL.md"),
      depth: 0
    });
  } else {
    walk(root, 0, candidates);
  }
  const byName = new Map;
  for (const c of candidates) {
    const prev = byName.get(c.name);
    if (!prev || c.depth < prev.depth)
      byName.set(c.name, c);
  }
  const skills = [];
  const seenNames = new Set;
  for (const c of byName.values()) {
    let content;
    try {
      content = readFileSync(c.file, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    const resolved = fm.name || c.name;
    if (seenNames.has(resolved))
      continue;
    seenNames.add(resolved);
    skills.push({ name: resolved, file: c.file, description: fm.description, body: fm.body });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

// src/fix.ts
import { readFileSync as readFileSync2, writeFileSync } from "node:fs";
var MAX_TRIGGERS = 5;
function deriveTriggers(skill) {
  const seen = new Set;
  const out = [];
  const push = (t) => {
    if (!seen.has(t) && !isGeneric(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  for (const t of tokenize(skill.name.replace(/[-_]/g, " ")))
    push(t);
  for (const t of skillTerms(skill).salient)
    push(t);
  return out.slice(0, MAX_TRIGGERS);
}
function applyFixes(skills, write) {
  const changes = [];
  for (const s of skills) {
    const desc = s.description.trim();
    if (!desc || hasUseWhen(desc))
      continue;
    const triggers = deriveTriggers(s);
    if (triggers.length < 2)
      continue;
    const tail = `Use when ${triggers.join(", ")}.`;
    const next = /[.!?]$/.test(desc) ? `${desc} ${tail}` : `${desc}. ${tail}`;
    let content;
    try {
      content = readFileSync2(s.file, "utf8");
    } catch {
      continue;
    }
    const updated = replaceDescription(content, next);
    if (!updated || updated === content)
      continue;
    if (write)
      writeFileSync(s.file, updated);
    changes.push({ skill: s.name, file: s.file, from: desc, to: next });
  }
  return { changes };
}

// src/lint.ts
var MIN_SALIENT = 3;
var MIN_DESC_TOKENS = 6;
var MAX_DESC_TOKENS = 120;
var GENERIC_RATIO = 0.6;
function norm(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
function lint(skills) {
  const findings = [];
  const byDesc = new Map;
  for (const s of skills) {
    if (!s.description)
      continue;
    const key = norm(s.description);
    const arr = byDesc.get(key) ?? [];
    arr.push(s.name);
    byDesc.set(key, arr);
  }
  for (const s of skills) {
    const desc = s.description.trim();
    if (!desc) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "error",
        rule: "empty-description",
        reason: "no description — the agent has nothing to match on, so it can never fire this skill",
        suggestion: 'add a description: "<what it does>. Use when <triggers>."'
      });
      continue;
    }
    const dupes = (byDesc.get(norm(desc)) ?? []).filter((n) => n !== s.name);
    if (dupes.length > 0) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "error",
        rule: "duplicate-description",
        reason: `identical description to: ${dupes.join(", ")} — the picker can't tell them apart`,
        suggestion: "differentiate the descriptions so each names its distinct intent"
      });
    }
    const descTokens = tokenize(desc);
    const st = skillTerms(s);
    if (!hasUseWhen(desc)) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "no-use-when",
        reason: 'no "use when …" trigger clause — the agent has to guess when this applies',
        suggestion: "append: Use when <the phrases a user would actually type>"
      });
    }
    if (descTokens.length < MIN_DESC_TOKENS) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "too-thin",
        reason: `description is only ${descTokens.length} content word(s) — too thin to match varied phrasing`,
        suggestion: "name concrete triggers, tools, and outcomes a request would mention"
      });
    } else if (descTokens.length > MAX_DESC_TOKENS) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "too-heavy",
        reason: `description is ${descTokens.length} words — it taxes every session's always-on context`,
        suggestion: "tighten to the trigger + outcome; move detail into the body"
      });
    }
    if (st.salient.size < MIN_SALIENT) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "vague",
        reason: `only ${st.salient.size} distinct, specific trigger term(s) — too generic to win against a focused skill`,
        suggestion: 'replace filler ("helps with code") with the specific task, tool, or noun'
      });
    } else {
      const genericCount = descTokens.filter(isGeneric).length;
      if (descTokens.length > 0 && genericCount / descTokens.length >= GENERIC_RATIO) {
        findings.push({
          skill: s.name,
          file: s.file,
          level: "warn",
          rule: "generic",
          reason: "mostly generic words — matches almost anything, so it loses to more specific skills",
          suggestion: "lead with the distinctive intent, not generic verbs"
        });
      }
    }
    const nameTokens = new Set(tokenize(s.name.replace(/[-_]/g, " ")));
    if (nameTokens.size > 0 && descTokens.length > 0 && descTokens.every((t) => nameTokens.has(t))) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "restates-name",
        reason: "description only restates the name — adds no new trigger vocabulary",
        suggestion: "describe what it does and when to use it, beyond the name"
      });
    }
  }
  return findings;
}

// src/collisions.ts
var COLLISION_THRESHOLD2 = 0.4;
var MIN_SHARED2 = 2;
function corpusCommon2(salientSets) {
  const n = salientSets.length;
  const df = new Map;
  for (const s of salientSets)
    for (const t of s)
      df.set(t, (df.get(t) ?? 0) + 1);
  const threshold = Math.max(4, Math.ceil(0.15 * n));
  const common = new Set;
  for (const [t, c] of df)
    if (c >= threshold)
      common.add(t);
  return common;
}
function jaccard2(a, b) {
  if (a.size === 0 || b.size === 0)
    return { j: 0, shared: [] };
  const shared = [];
  for (const t of a)
    if (b.has(t))
      shared.push(t);
  const union = a.size + b.size - shared.length;
  return { j: union === 0 ? 0 : shared.length / union, shared };
}
function findCollisions2(skills) {
  const terms = skills.map(skillTerms).filter((t) => t.salient.size > 0);
  const n = terms.length;
  const common = corpusCommon2(terms.map((t) => t.salient));
  const distinctive = terms.map((t) => {
    const d = new Set;
    for (const x of t.salient)
      if (!common.has(x))
        d.add(x);
    return d;
  });
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => parent[x] === x ? x : parent[x] = find(parent[x]);
  const edgeJ = new Map;
  const pairShared = new Map;
  for (let i = 0;i < n; i++) {
    for (let k = i + 1;k < n; k++) {
      const { j, shared } = jaccard2(distinctive[i], distinctive[k]);
      if (j >= COLLISION_THRESHOLD2 && shared.length >= MIN_SHARED2) {
        parent[find(i)] = find(k);
        const key = `${i}-${k}`;
        edgeJ.set(key, j);
        pairShared.set(key, shared);
      }
    }
  }
  const clusters = new Map;
  for (let i = 0;i < n; i++) {
    const r = find(i);
    const arr = clusters.get(r) ?? [];
    arr.push(i);
    clusters.set(r, arr);
  }
  const out = [];
  for (const members of clusters.values()) {
    if (members.length < 2)
      continue;
    const sharedCount = new Map;
    let jSum = 0;
    let edges = 0;
    for (let a = 0;a < members.length; a++) {
      for (let b = a + 1;b < members.length; b++) {
        const lo = Math.min(members[a], members[b]);
        const hi = Math.max(members[a], members[b]);
        const sh = pairShared.get(`${lo}-${hi}`);
        if (!sh)
          continue;
        edges++;
        jSum += edgeJ.get(`${lo}-${hi}`) ?? 0;
        for (const t of sh)
          sharedCount.set(t, (sharedCount.get(t) ?? 0) + 1);
      }
    }
    const shared = [...sharedCount.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t);
    out.push({
      skills: members.map((i) => terms[i].skill.name).sort(),
      shared,
      strength: edges ? jSum / edges : 0
    });
  }
  out.sort((a, b) => b.strength - a.strength || b.skills.length - a.skills.length);
  return out;
}

// src/lint.ts
var MIN_SALIENT2 = 3;
var MIN_DESC_TOKENS2 = 6;
var MAX_DESC_TOKENS2 = 120;
var GENERIC_RATIO2 = 0.6;
function norm2(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
function lint2(skills) {
  const findings = [];
  const byDesc = new Map;
  for (const s of skills) {
    if (!s.description)
      continue;
    const key = norm2(s.description);
    const arr = byDesc.get(key) ?? [];
    arr.push(s.name);
    byDesc.set(key, arr);
  }
  for (const s of skills) {
    const desc = s.description.trim();
    if (!desc) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "error",
        rule: "empty-description",
        reason: "no description — the agent has nothing to match on, so it can never fire this skill",
        suggestion: 'add a description: "<what it does>. Use when <triggers>."'
      });
      continue;
    }
    const dupes = (byDesc.get(norm2(desc)) ?? []).filter((n) => n !== s.name);
    if (dupes.length > 0) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "error",
        rule: "duplicate-description",
        reason: `identical description to: ${dupes.join(", ")} — the picker can't tell them apart`,
        suggestion: "differentiate the descriptions so each names its distinct intent"
      });
    }
    const descTokens = tokenize(desc);
    const st = skillTerms(s);
    if (!hasUseWhen(desc)) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "no-use-when",
        reason: 'no "use when …" trigger clause — the agent has to guess when this applies',
        suggestion: "append: Use when <the phrases a user would actually type>"
      });
    }
    if (descTokens.length < MIN_DESC_TOKENS2) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "too-thin",
        reason: `description is only ${descTokens.length} content word(s) — too thin to match varied phrasing`,
        suggestion: "name concrete triggers, tools, and outcomes a request would mention"
      });
    } else if (descTokens.length > MAX_DESC_TOKENS2) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "too-heavy",
        reason: `description is ${descTokens.length} words — it taxes every session's always-on context`,
        suggestion: "tighten to the trigger + outcome; move detail into the body"
      });
    }
    if (st.salient.size < MIN_SALIENT2) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "vague",
        reason: `only ${st.salient.size} distinct, specific trigger term(s) — too generic to win against a focused skill`,
        suggestion: 'replace filler ("helps with code") with the specific task, tool, or noun'
      });
    } else {
      const genericCount = descTokens.filter(isGeneric).length;
      if (descTokens.length > 0 && genericCount / descTokens.length >= GENERIC_RATIO2) {
        findings.push({
          skill: s.name,
          file: s.file,
          level: "warn",
          rule: "generic",
          reason: "mostly generic words — matches almost anything, so it loses to more specific skills",
          suggestion: "lead with the distinctive intent, not generic verbs"
        });
      }
    }
    const nameTokens = new Set(tokenize(s.name.replace(/[-_]/g, " ")));
    if (nameTokens.size > 0 && descTokens.length > 0 && descTokens.every((t) => nameTokens.has(t))) {
      findings.push({
        skill: s.name,
        file: s.file,
        level: "warn",
        rule: "restates-name",
        reason: "description only restates the name — adds no new trigger vocabulary",
        suggestion: "describe what it does and when to use it, beyond the name"
      });
    }
  }
  return findings;
}
function grade(findings) {
  if (findings.some((f) => f.level === "error"))
    return "F";
  const warns = findings.filter((f) => f.level === "warn").length;
  if (warns === 0)
    return "A";
  if (warns === 1)
    return "B";
  if (warns === 2)
    return "C";
  return "D";
}

// src/llm.ts
import { spawnSync } from "node:child_process";
function whichCli() {
  for (const c of ["claude", "codex"]) {
    const r = spawnSync("which", [c], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim())
      return c;
  }
  return null;
}
function buildPrompt(skills, prompt) {
  const list = skills.map((s) => `- ${s.name}: ${s.description}`).join(`
`);
  return [
    "You are a coding agent's skill picker. Given a user request and a list of",
    "installed skills (name: description), decide which would fire and how",
    'strongly. Return ONLY JSON: {"scores":[{"skill":"<name>","score":<0..1>}]}',
    "ordered best first. No prose.",
    "",
    `User request: ${prompt}`,
    "",
    "Skills:",
    list
  ].join(`
`);
}
function llmJudge(skills, prompt) {
  const cli = whichCli();
  if (!cli)
    return null;
  const args = cli === "claude" ? ["-p", buildPrompt(skills, prompt)] : ["exec", buildPrompt(skills, prompt)];
  const r = spawnSync(cli, args, { encoding: "utf8", timeout: 60000 });
  if (r.status !== 0 || !r.stdout)
    return null;
  const m = r.stdout.match(/\{[\s\S]*\}/);
  if (!m)
    return null;
  let parsed;
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.scores))
    return null;
  const byName = new Map(skills.map((s) => [s.name, s.file]));
  const scores = parsed.scores.filter((s) => s.skill && byName.has(s.skill)).map((s) => ({
    skill: s.skill,
    file: byName.get(s.skill) ?? "",
    score: Math.max(0, Math.min(1, Number(s.score) || 0)),
    matched: []
  }));
  if (scores.length === 0)
    return null;
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0]?.score ?? 0;
  const second = scores[1]?.score ?? 0;
  return { prompt, scores, margin: top - second, noFire: top < 0.3, engine: "llm" };
}

// src/simulate.ts
var FIRE_THRESHOLD = 0.3;
var AMBIGUOUS_MARGIN = 0.08;
function simulate(skills, prompt) {
  const { terms, df } = corpus(skills);
  const n = Math.max(skills.length, 1);
  const promptTerms = [...new Set(tokenize(prompt))];
  const denom = promptTerms.reduce((s, t) => s + idf(t, df, n), 0) || 1;
  const scores = terms.map((st) => {
    let raw = 0;
    const matched = [];
    for (const t of promptTerms) {
      const w = st.weights.get(t);
      if (w) {
        raw += w * idf(t, df, n);
        matched.push(t);
      }
    }
    return {
      skill: st.skill.name,
      file: st.skill.file,
      score: Math.min(1, raw / denom),
      matched
    };
  });
  scores.sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill));
  const top = scores[0]?.score ?? 0;
  const second = scores[1]?.score ?? 0;
  return {
    prompt,
    scores,
    margin: top - second,
    noFire: top < FIRE_THRESHOLD,
    engine: "heuristic"
  };
}
function missingTerms(skills, prompt, skillName) {
  const { terms, df } = corpus(skills);
  const n = Math.max(skills.length, 1);
  const target = terms.find((t) => t.skill.name === skillName);
  if (!target)
    return [];
  const promptTerms = [...new Set(tokenize(prompt))];
  return promptTerms.filter((t) => !target.weights.has(t)).sort((a, b) => idf(b, df, n) - idf(a, df, n));
}

// src/report.ts
var COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
var red = (s) => COLOR ? `\x1B[31m${s}\x1B[0m` : s;
var yellow = (s) => COLOR ? `\x1B[33m${s}\x1B[0m` : s;
var green = (s) => COLOR ? `\x1B[32m${s}\x1B[0m` : s;
var dim = (s) => COLOR ? `\x1B[2m${s}\x1B[0m` : s;
var bold = (s) => COLOR ? `\x1B[1m${s}\x1B[0m` : s;
function gradeColor(g) {
  if (g === "A")
    return green(g);
  if (g === "F")
    return red(g);
  return yellow(g);
}
function buildLintReport(skills, findings) {
  const bySkill = new Map;
  for (const s of skills)
    bySkill.set(s.name, []);
  for (const f of findings)
    (bySkill.get(f.skill) ?? []).push(f);
  const errors = findings.filter((f) => f.level === "error").length;
  const warns = findings.filter((f) => f.level === "warn").length;
  const lines = [];
  for (const [name, fs] of bySkill) {
    const g = grade(fs);
    if (fs.length === 0) {
      lines.push(`${gradeColor(g)}  ${name}  ${green("✓ will fire on its triggers")}`);
      continue;
    }
    lines.push(`${gradeColor(g)}  ${bold(name)}`);
    for (const f of fs) {
      const mark = f.level === "error" ? red("✗") : yellow("!");
      lines.push(`     ${mark} ${f.reason}`);
      if (f.suggestion)
        lines.push(`       ${green(`→ ${f.suggestion}`)}`);
    }
  }
  const summary = `
${skills.length} skills · ${errors ? red(`${errors} error`) : green("0 errors")} · ${yellow(`${warns} warning`)}`;
  lines.push(summary);
  return {
    text: lines.join(`
`),
    json: {
      skills: skills.length,
      errors,
      warnings: warns,
      grades: [...bySkill].map(([name, fs]) => ({
        skill: name,
        grade: grade(fs),
        findings: fs.map((f) => ({ rule: f.rule, level: f.level, reason: f.reason, suggestion: f.suggestion ?? null }))
      }))
    },
    exitCode: errors > 0 ? 1 : 0
  };
}
function buildWhyReport(skills, prompt, opts = {}) {
  const focusSkill = opts.focusSkill;
  const sim = opts.useLlm && llmJudge(skills, prompt) || simulate(skills, prompt);
  const lines = [];
  const engineNote = opts.useLlm && sim.engine === "heuristic" ? dim("  (no agent CLI found — using offline heuristic)") : "";
  lines.push(`${dim(`prompt [${sim.engine}]:`)} ${bold(prompt)}${engineNote}`);
  const top = sim.scores.slice(0, 8);
  top.forEach((s, i) => {
    const pct = s.score.toFixed(2);
    let tag = "";
    if (i === 0 && !sim.noFire)
      tag = green("  ← would fire");
    if (i === 0 && sim.noFire)
      tag = red("  ← too weak to fire reliably");
    if (i === 1 && sim.margin < AMBIGUOUS_MARGIN && !sim.noFire)
      tag = yellow(`  (margin ${sim.margin.toFixed(2)} — ambiguous, likely collision)`);
    const matched = s.matched.length ? dim(`  [${s.matched.join(" ")}]`) : dim("  [no terms matched]");
    lines.push(`  ${String(i + 1).padStart(2)}. ${s.skill.padEnd(22)} ${pct}${matched}${tag}`);
  });
  if (sim.noFire) {
    lines.push(`
${red("no skill reliably fires")} for this prompt — the best match is weak. If one should have fired, its description is missing the prompt's vocabulary.`);
  }
  const focus = focusSkill;
  if (focus) {
    const miss = missingTerms(skills, prompt, focus);
    const rank = sim.scores.findIndex((s) => s.skill === focus);
    lines.push(`
${bold(focus)} ranked #${rank + 1} (${(sim.scores[rank]?.score ?? 0).toFixed(2)}).`);
    if (miss.length)
      lines.push(green(`→ add these prompt terms to its description: ${miss.join(", ")}`));
  }
  return {
    text: lines.join(`
`),
    json: { prompt, engine: sim.engine, noFire: sim.noFire, margin: sim.margin, scores: sim.scores },
    exitCode: 0
  };
}
function buildCollisionsReport(skills, collisions) {
  const lines = [];
  if (collisions.length === 0) {
    lines.push(green(`✓ no collisions — ${skills.length} skills have distinct trigger vocabularies`));
  } else {
    lines.push(`${yellow(`${collisions.length} collision cluster(s)`)} — within each, one skill silently wins the shared intent and the others never fire:
`);
    for (const c of collisions) {
      lines.push(`  ${bold(c.skills.join(" ⇄ "))}  ${dim(`(overlap ${(c.strength * 100).toFixed(0)}%)`)}`);
      lines.push(`     ${dim("shared triggers:")} ${c.shared.slice(0, 10).join(", ")}`);
      lines.push(`     ${green("→ make each description name what makes it distinct, or merge them")}`);
    }
  }
  return {
    text: lines.join(`
`),
    json: { skills: skills.length, collisions },
    exitCode: 0
  };
}
function buildDefaultReport(skills) {
  const findings = lint2(skills);
  const base = buildLintReport(skills, findings);
  const collisions = findCollisions2(skills);
  const note = collisions.length ? `${yellow(`${collisions.length} collision cluster(s)`)} found — run ${bold("--collisions")} to see which skills shadow each other.` : green("no skill collisions.");
  return {
    text: `${base.text}
${note}`,
    json: { ...base.json, collisions: collisions.length },
    exitCode: base.exitCode
  };
}

// src/cli.ts
var HELP = `skill-issue \u2014 find out why your skill won't fire.

Usage:
  skill-issue [path] [options]

Arguments:
  path                 Skills root to scan (default: current directory). A folder
                       of skills (each subdir has SKILL.md), a single skill dir,
                       or a repo with skills/ and agents/ definitions.

Options:
  --why "<prompt>"     Simulate which skill the agent would fire for a prompt,
                       ranked, with the margin and the terms each matched on.
  --skill <name>       With --why: focus on one skill and report what prompt
                       vocabulary its description is missing.
  --collisions         Report clusters of skills that compete for the same
                       intent (one silently wins, the others never fire).
  --fix                Rewrite weak descriptions in place: append a "Use when \u2026"
                       trigger clause built from the skill's own vocabulary.
                       Only high-confidence cases; never invents capability.
  --llm                Use a local agent CLI (claude/codex) as the judge for
                       --why instead of the offline heuristic. Falls back if none.
  --json               Emit machine-readable JSON instead of the text report.
  -h, --help           Show this help.

Default (no mode flag): lint \u2014 grade every skill A\u2013F on whether it will reliably
fire, plus a one-line collisions summary. Exit code 1 when any skill has an
error-level defect (empty or duplicated description).`;
function main(argv) {
  const args = argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    return 0;
  }
  let path = ".";
  let json = false;
  let fix = false;
  let collisions = false;
  let useLlm = false;
  let why;
  let focusSkill;
  for (let i = 0;i < args.length; i++) {
    const a = args[i];
    if (a === "--json") {
      json = true;
    } else if (a === "--fix") {
      fix = true;
    } else if (a === "--collisions") {
      collisions = true;
    } else if (a === "--llm") {
      useLlm = true;
    } else if (a === "--why") {
      const v = args[++i];
      if (!v || v.startsWith("--")) {
        console.error('skill-issue: --why needs a prompt, e.g. --why "deploy to prod"');
        return 2;
      }
      why = v;
    } else if (a === "--skill") {
      const v = args[++i];
      if (!v || v.startsWith("--")) {
        console.error("skill-issue: --skill needs a skill name");
        return 2;
      }
      focusSkill = v;
    } else if (a.startsWith("-")) {
      console.error(`skill-issue: unknown option '${a}' (try --help)`);
      return 2;
    } else {
      path = a;
    }
  }
  if (!existsSync(path)) {
    console.error(`skill-issue: path not found: ${path}`);
    return 2;
  }
  const skills = loadSkills(path);
  if (skills.length === 0) {
    console.error(`skill-issue: no skills found under ${path} (looked for SKILL.md / agents/*.md)`);
    return 2;
  }
  if (why !== undefined) {
    const report2 = buildWhyReport(skills, why, { useLlm, focusSkill });
    console.log(json ? JSON.stringify(report2.json, null, 2) : report2.text);
    return report2.exitCode;
  }
  if (collisions) {
    const report2 = buildCollisionsReport(skills, findCollisions(skills));
    console.log(json ? JSON.stringify(report2.json, null, 2) : report2.text);
    return report2.exitCode;
  }
  if (fix) {
    const { changes } = applyFixes(skills, true);
    if (json) {
      console.log(JSON.stringify({ fixed: changes.length, changes }, null, 2));
    } else if (changes.length === 0) {
      console.log("skill-issue --fix: nothing to auto-heal (no confident description rewrites).");
    } else {
      console.log(`skill-issue --fix: added a trigger clause to ${changes.length} skill(s):`);
      for (const c of changes)
        console.log(`  ${c.skill}
    ${c.file}`);
    }
    return lint(loadSkills(path)).some((f) => f.level === "error") ? 1 : 0;
  }
  const report = buildDefaultReport(skills);
  console.log(json ? JSON.stringify(report.json, null, 2) : report.text);
  return report.exitCode;
}
process.exit(main(process.argv));
