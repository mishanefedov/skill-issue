// Public API — import skill-issue's engine as a library.
export { loadSkills } from "./src/discover.ts";
export { parseFrontmatter } from "./src/frontmatter.ts";
export { lint, grade } from "./src/lint.ts";
export { simulate, missingTerms } from "./src/simulate.ts";
export { findCollisions } from "./src/collisions.ts";
export { applyFixes } from "./src/fix.ts";
export { corpus, skillTerms, tokenize } from "./src/triggers.ts";
export type * from "./src/types.ts";
