import { wallParts } from './posts';

/**
 * Post slugs are timestamps in the wall clock where the post was made:
 * `2026-10-29-1911`. A second post in the same minute gets `-2`, then `-3`.
 * `stored` is the post's date string as it will be written to the file.
 */
export function slugFor(stored: string, taken: string[]): string {
  const p = wallParts(stored);
  const base = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
