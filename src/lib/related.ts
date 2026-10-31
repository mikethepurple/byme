// Small pure helpers behind the cards and the page heads, so they are tested
// on their own, without astro:content.
import { formatShort, laneOf, type Kind } from './posts';

/** The little of a post these functions need. */
export interface Like {
  id: string;
  when: Date;
  date: string; // as stored
  things: string[]; // thing ids
  kind: Kind;
  title: string;
  plain: string;
  images: number;
}

/** The pseudo-project of posts that belong to none. */
export const MISC = 'misc';

export const KIND_LABEL: Record<Kind, string> = { photo: 'Photo', set: 'Set', note: 'Note', longread: 'Longread' };

/** A post belongs to its first project, or to misc. */
export function projectOf(p: { things: string[] }): string {
  return p.things[0] ?? MISC;
}

export interface LedgerRow {
  id: string;
  kind: string;
  title: string;
  date: string;
}

/** What a post is called: its title, else "2 photos", "Photo", or its first words. */
export function titleOf(p: Pick<Like, 'title' | 'kind' | 'plain' | 'images'>, max = 60): string {
  if (p.title) return p.title;
  if (p.kind === 'set') return `${p.images} photos`;
  if (p.kind === 'photo') return 'Photo';
  return excerpt(p.plain.split('\n')[0] ?? '', max) || KIND_LABEL[p.kind];
}

/**
 * The latest posts as rows of kind · title · date, at most n, never two rows
 * that read the same; blank rows pad to n.
 */
export function ledger(posts: Like[], n: number): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const seen = new Set<string>();
  for (const p of posts) {
    if (rows.length >= n) break;
    const row = { id: p.id, kind: KIND_LABEL[p.kind], title: titleOf(p), date: formatShort(p.date).split(',')[0] };
    // a repeat is the same text posted twice within a minute, not two photos on one day
    const key = `${row.kind}|${row.title}|${p.date.slice(0, 16)}|${p.title || p.plain ? '' : p.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  while (rows.length < n) rows.push({ id: '', kind: '', title: '', date: '' });
  return rows;
}

/** Reading time at about 200 words a minute, at least one. */
export function readMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** "26 Oct – 30 Oct", or one day when the span is a day. */
export function dateRange(posts: Like[]): string {
  if (posts.length === 0) return '';
  const day = (p: Like) => formatShort(p.date).split(',')[0];
  const sorted = [...posts].sort((a, b) => a.when.getTime() - b.when.getTime());
  const a = day(sorted[0]);
  const b = day(sorted[sorted.length - 1]);
  return a === b ? a : `${a} – ${b}`;
}

/** About n characters, cut at a word, with an ellipsis when cut. */
export function excerpt(text: string, n: number): string {
  const t = text.trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const at = cut.lastIndexOf(' ');
  return (at > n / 2 ? cut.slice(0, at) : cut).trimEnd() + '…';
}

export const ALL_LANES = ['photos', 'sets', 'longreads', 'notes'] as const;

/** The lanes that have posts, in the fixed order. */
export function kindsPresent(posts: Like[]): string[] {
  const have = new Set(posts.map((p) => laneOf(p.kind)));
  return ALL_LANES.filter((l) => have.has(l));
}

/** How many empty cells fill out the last row of count cells in n columns. */
export function padTo(count: number, n: number): number {
  return count % n === 0 ? 0 : n - (count % n);
}

/** Edges under a project frame: none without posts, then 1 + log2(n)·1.6, at most 10. */
export function stackEdges(n: number): number {
  // one edge per post, at most 10 (Misha 31.10: the edges read as the post count)
  return Math.max(0, Math.min(10, n));
}
