// What goes where, without touching astro:content: the front grid's cells and
// the posts shown beside an open one. Pure, so they are tested on their own.

/** The little of a post these functions need. */
export interface Like {
  id: string;
  when: Date;
  things: string[]; // thing ids
  pinned: boolean;
}

export type FrontCell<T extends { id: string }, P extends Like> = { kind: 'thing'; thing: T } | { kind: 'post'; post: P };

/**
 * The front page: the projects in their order, then whatever he pinned, then
 * the latest posts that are not pinned, up to `latest` — all newest first.
 */
export function frontCells<T extends { id: string }, P extends Like>(things: T[], posts: P[], latest = 0): FrontCell<T, P>[] {
  const cells: FrontCell<T, P>[] = things.map((thing) => ({ kind: 'thing', thing }));
  for (const post of posts) if (post.pinned) cells.push({ kind: 'post', post });
  let n = 0;
  for (const post of posts) {
    if (post.pinned || n >= latest) continue;
    cells.push({ kind: 'post', post });
    n++;
  }
  return cells;
}

/**
 * Beside an open post: the rest of its first project, newest first; then the
 * nearest posts by date on either side. Never the post itself, at most n.
 */
export function similar<P extends Like>(post: P, posts: P[], n: number): P[] {
  const out: P[] = [];
  const seen = new Set<string>([post.id]);
  const take = (p: P) => {
    if (out.length < n && !seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  };
  const thing = post.things[0];
  if (thing) for (const p of posts) if (p.things.includes(thing)) take(p);
  // then one newer, one older, one newer… nearest first on each side
  const t = post.when.getTime();
  const newer = posts.filter((p) => p.when.getTime() > t).sort((a, b) => a.when.getTime() - b.when.getTime());
  const older = posts.filter((p) => p.when.getTime() <= t && p.id !== post.id).sort((a, b) => b.when.getTime() - a.when.getTime());
  for (let i = 0; i < Math.max(newer.length, older.length); i++) {
    if (newer[i]) take(newer[i]);
    if (older[i]) take(older[i]);
  }
  return out;
}
