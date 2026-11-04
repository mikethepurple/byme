// Free tags: the #words on a post's last line (or a client's categories) that
// are not a project. Pure, so the publish endpoint and the pages share them.
import { MISC } from './related';

/** `#Side Quest` → `side-quest`: no #, lower case, letters/digits/dashes only. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/** Categories as sent: project ids become the post's projects, the rest its tags. misc is no tag. */
export function splitCategories(categories: string[], projects: string[]): { things: string[]; tags: string[] } {
  const things: string[] = [];
  const tags: string[] = [];
  for (const c of categories) {
    const t = normalizeTag(c);
    if (!t || t === MISC) continue;
    const into = projects.includes(t) ? things : tags;
    if (!into.includes(t)) into.push(t);
  }
  return { things, tags };
}

type Tagged = { data: { tags: string[] } };

/** The tags on these posts, most used first, then a–z. */
export function tagsPresent(posts: Tagged[]): string[] {
  const n = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)! || a.localeCompare(b));
}

export function withTag<T extends Tagged>(posts: T[], tag: string): T[] {
  return posts.filter((p) => p.data.tags.includes(tag));
}

/**
 * #words anywhere in the text ("a #paper sketch"): a # after a space, a line
 * start or a bracket, then a letter. Headings ("# Title"), numbers ("#12"),
 * link anchors ("/page#x") and code are not tags. The text keeps them.
 */
export function inlineTags(content: string): string[] {
  const text = content.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
  const out: string[] = [];
  for (const m of text.matchAll(/(?<=^|[\s(])#(\p{L}[\p{L}\p{N}_-]*)/gmu)) {
    const t = normalizeTag(m[1]);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
