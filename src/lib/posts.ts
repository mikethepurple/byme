// Pure helpers shared by the pages and the publish endpoint.
// The kind of a post is inferred from what was dropped; it is never stored.
// A post's date is stored as the wall clock where it was posted, with its
// offset (`2026-11-03T09:15:00+09:00`); slugs and date lines read it literally,
// so a post from Tokyo keeps Tokyo time wherever it is read.

export type Kind = 'photo' | 'set' | 'note' | 'longread';

export const KINDS: Kind[] = ['photo', 'set', 'note', 'longread'];

/** Body length (characters) from which a text-only post reads as a longread. */
export const LONGREAD_CHARS = 600;

/** Zone assumed for stored dates that carry no offset (older posts, Keystatic edits). */
export const HOME_ZONE = 'Europe/Paris';

export function kindOf(p: { images: number; body: string; link?: string }): Kind {
  if (p.images === 1) return 'photo';
  if (p.images > 1) return 'set';
  if (p.body.trim().length >= LONGREAD_CHARS) return 'longread';
  return 'note';
}

/** Which lane a kind is read in: sets live in the photos lane. */
export function laneOf(kind: Kind): 'photos' | 'longreads' | 'notes' {
  if (kind === 'photo' || kind === 'set') return 'photos';
  if (kind === 'longread') return 'longreads';
  return 'notes';
}

export type Parts = Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>;

/** Calendar parts of an instant as seen in a zone. */
export function partsIn(date: Date, zone: string): Parts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out = {} as Parts;
  for (const p of fmt.formatToParts(date)) {
    if (p.type in { year: 1, month: 1, day: 1, hour: 1, minute: 1, second: 1 }) {
      out[p.type as keyof Parts] = p.value;
    }
  }
  return out;
}

function offsetMinutes(utc: Date, zone: string): number {
  const p = partsIn(utc, zone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - utc.getTime()) / 60000);
}

/** `2026-11-03T09:15:00+09:00`: the wall clock of `date` in `zone`, with the offset. */
export function toIsoInZone(date: Date, zone: string): string {
  const p = partsIn(date, zone);
  const off = offsetMinutes(date, zone);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${hh}:${mm}`;
}

const STORED = /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d)(?::(\d\d))?)?(Z|[+-]\d\d:?\d\d)?$/;

/** The wall-clock parts of a stored date string, read literally (Z = UTC wall clock). */
export function wallParts(stored: string): Parts {
  const m = stored.match(STORED);
  if (!m) return partsIn(new Date(stored), HOME_ZONE);
  const [, year, month, day, hour = '00', minute = '00', second = '00', zone] = m;
  if (zone === 'Z') return partsIn(new Date(stored), 'UTC');
  return { year, month, day, hour, minute, second };
}

/** The instant a stored date names; a string without a zone is taken as HOME_ZONE. */
export function parseDate(stored: string): Date {
  const m = stored.match(STORED);
  if (!m) return new Date(stored);
  if (m[7]) return new Date(stored);
  const [, y, mo, d, h = '0', mi = '0', sec = '0'] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
  const off1 = offsetMinutes(new Date(guess), HOME_ZONE);
  let utc = guess - off1 * 60000;
  const off2 = offsetMinutes(new Date(utc), HOME_ZONE);
  if (off2 !== off1) utc = guess - off2 * 60000;
  return new Date(utc);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `29 Oct 2026, 19:11` — as posted. */
export function formatDate(stored: string): string {
  const p = wallParts(stored);
  return `${+p.day} ${MONTHS[+p.month - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

/** `29 Oct, 19:11` for the block line. */
export function formatShort(stored: string): string {
  const p = wallParts(stored);
  return `${+p.day} ${MONTHS[+p.month - 1]}, ${p.hour}:${p.minute}`;
}
