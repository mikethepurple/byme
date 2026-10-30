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

/** The latest n posts as rows of kind · title · date; blank rows pad to n. */
export function ledger(posts: Like[], n: number): LedgerRow[] {
  const rows: LedgerRow[] = posts.slice(0, n).map((p) => ({
    id: p.id,
    kind: KIND_LABEL[p.kind],
    title: p.title || excerpt(p.plain.split('\n')[0] ?? '', 60),
    date: formatShort(p.date).split(',')[0],
  }));
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
