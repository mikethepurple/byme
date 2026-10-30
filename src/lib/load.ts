import { getCollection, type CollectionEntry } from 'astro:content';
import { kindOf, parseDate, laneOf, plain, type Kind } from './posts';

// `things` (ids) and `pinned` are lifted out of `data` so a Post satisfies the
// `Like` shape the pure helpers in related.ts work on.
export type Post = CollectionEntry<'posts'> & { kind: Kind; when: Date; text: string; plain: string; things: string[]; pinned: boolean };
export type Thing = CollectionEntry<'things'>;

export const LANES = ['photos', 'longreads', 'notes'] as const;
export type Lane = (typeof LANES)[number];

export const PAGE_SIZE = 30;

/** Published posts, newest first, with the inferred kind and a parsed date. */
export async function loadPosts(): Promise<Post[]> {
  const all = await getCollection('posts', (p) => !p.data.draft);
  return all
    .map((p) => {
      const text = (p.body ?? '').trim();
      const kind = kindOf({ images: p.data.images.length, body: text, link: p.data.link || undefined });
      return Object.assign(p, {
        kind,
        when: parseDate(p.data.date),
        text,
        plain: plain(text),
        things: p.data.things.map((t) => t.id),
        pinned: p.data.pinned,
      });
    })
    .sort((a, b) => b.when.getTime() - a.when.getTime());
}

export async function loadThings(): Promise<Thing[]> {
  const all = await getCollection('things');
  return all.sort((a, b) => a.data.order - b.data.order);
}

export function thingNames(things: Thing[]): Map<string, string> {
  return new Map(things.map((t) => [t.id, t.data.name]));
}

export function thingColors(things: Thing[]): Map<string, string> {
  return new Map(things.filter((t) => t.data.color).map((t) => [t.id, t.data.color]));
}

export function postsOf(posts: Post[], thingId: string): Post[] {
  return posts.filter((p) => p.data.things.some((t) => t.id === thingId));
}

export function postsIn(posts: Post[], lane: Lane): Post[] {
  return posts.filter((p) => laneOf(p.kind) === lane);
}

export interface Scope {
  thing?: string;
  lane?: Lane;
  month?: string; // YYYY-MM
}

/** The feed narrowed to what the index has in force. */
export function scopePosts(posts: Post[], s: Scope): Post[] {
  let out = posts;
  if (s.thing) out = postsOf(out, s.thing);
  if (s.lane) out = postsIn(out, s.lane);
  if (s.month) out = out.filter((p) => p.data.date.startsWith(s.month!));
  return out;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "October 2026" for a month, "2026" for a whole year. */
export function monthLabel(m: string): string {
  if (m.length === 4) return m;
  return `${MONTH_NAMES[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
}

export function yearsOf(posts: Post[]): string[] {
  return Array.from(new Set(posts.map((p) => p.data.date.slice(0, 4)))).sort().reverse();
}

/** "everything", "Ada", "Ada · photos", "October 2026" */
export function scopeLabel(s: Scope, names: Map<string, string>): string {
  const parts: string[] = [];
  if (s.thing) parts.push(names.get(s.thing) ?? s.thing);
  if (s.lane) parts.push(s.lane);
  if (s.month) parts.push(monthLabel(s.month));
  return parts.length ? parts.join(' · ') : 'everything';
}

export function monthsOf(posts: Post[]): string[] {
  return Array.from(new Set(posts.map((p) => p.data.date.slice(0, 7)))).sort().reverse();
}

/** First line of the text, for titles in feeds and tabs. */
export function firstLine(text: string, max = 80): string {
  const line = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  const plain = line.replace(/^#+\s*/, '').replace(/[*_`>]/g, '');
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain;
}
