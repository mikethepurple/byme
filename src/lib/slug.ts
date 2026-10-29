import { parisParts } from './posts';

/**
 * Post slugs are timestamps in Paris time: `2026-10-29-1911`.
 * A second post in the same minute gets `-2`, then `-3`.
 */
export function slugFor(date: Date, taken: string[]): string {
  const p = parisParts(date);
  const base = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
