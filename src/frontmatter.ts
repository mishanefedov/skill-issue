// Parse a SKILL.md / agent markdown file into its always-on metadata and body.
//
// The agent picker only ever reads `name` + `description`; the body loads when
// the skill fires. We parse exactly that split. Descriptions are often YAML
// folded scalars (`description: >`) spanning indented continuation lines until
// the next top-level key — we handle that the way an agent loader does.

export interface Frontmatter {
	name: string;
	description: string;
	body: string;
}

/** Pull name + description (the always-on metadata) and the body. */
export function parseFrontmatter(content: string): Frontmatter {
	const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) return { name: "", description: "", body: content };
	const fm = m[1] as string;
	const body = m[2] ?? "";
	const name = (fm.match(/^name:\s*(.+)$/m)?.[1] ?? "").trim();
	return { name, description: readFolded(fm, "description"), body };
}

/**
 * Read a frontmatter value that may be a folded (`>`/`|`) scalar spanning
 * indented continuation lines until the next top-level `key:`.
 */
export function readFolded(fm: string, key: string): string {
	const dm = fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
	if (!dm) return "";
	const start = (dm.index ?? 0) + (dm[0] as string).length;
	const rest = fm.slice(start).split("\n");
	const head = (dm[1] ?? "").replace(/^[>|]\s*/, "").trim();
	const cont: string[] = [];
	for (const line of rest) {
		if (/^\S/.test(line) && /^[\w-]+:/.test(line)) break; // next top-level key
		cont.push(line.trim());
	}
	return [head, ...cont].join(" ").trim();
}

/**
 * Rewrite the `description:` value inside a file's frontmatter to a single-line
 * form. Returns null when there's no frontmatter to edit. Used by --fix; it
 * normalizes folding but never touches the body or other keys.
 */
export function replaceDescription(content: string, next: string): string | null {
	const m = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/);
	if (!m) return null;
	const [, open, fm, close, body] = m as unknown as [string, string, string, string, string];
	const lines = fm.split("\n");
	const out: string[] = [];
	let i = 0;
	let replaced = false;
	while (i < lines.length) {
		const line = lines[i] as string;
		if (/^description:/.test(line)) {
			out.push(`description: ${next}`);
			replaced = true;
			i++;
			// skip folded continuation lines
			while (i < lines.length) {
				const l = lines[i] as string;
				if (/^\S/.test(l) && /^[\w-]+:/.test(l)) break;
				i++;
			}
			continue;
		}
		out.push(line);
		i++;
	}
	if (!replaced) out.unshift(`description: ${next}`);
	return `${open}${out.join("\n")}${close}${body}`;
}
