import { getCollection, type CollectionEntry } from 'astro:content';
import { kindOf, parseDate, laneOf, type Kind } from './posts';

export type Post = CollectionEntry<'posts'> & { kind: Kind; when: Date; text: string };
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
      return Object.assign(p, { kind, when: parseDate(p.data.date), text });
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

export function postsOf(posts: Post[], thingId: string): Post[] {
  return posts.filter((p) => p.data.things.some((t) => t.id === thingId));
}

export function postsIn(posts: Post[], lane: Lane): Post[] {
  return posts.filter((p) => laneOf(p.kind) === lane);
}

/** First line of the text, for titles in feeds and tabs. */
export function firstLine(text: string, max = 80): string {
  const line = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  const plain = line.replace(/^#+\s*/, '').replace(/[*_`>]/g, '');
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain;
}
