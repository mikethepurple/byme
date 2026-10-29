// Pure helpers shared by the pages and the publish endpoint.
// The kind of a post is inferred from what was dropped; it is never stored.

export type Kind = 'photo' | 'set' | 'note' | 'longread';

export const KINDS: Kind[] = ['photo', 'set', 'note', 'longread'];

/** Body length (characters) from which a text-only post reads as a longread. */
export const LONGREAD_CHARS = 600;

export const ZONE = 'Europe/Paris';

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

type Parts = Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>;

/** Calendar parts of an instant as seen in Paris. */
export function parisParts(date: Date): Parts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
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

function parisOffsetMinutes(utc: Date): number {
  const p = parisParts(utc);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUtc - utc.getTime()) / 60000;
}

/**
 * Stored dates come from Keystatic (`2026-10-29T19:11`, no zone) or from the
 * publish endpoint (full ISO with offset). A string without a zone is Paris time.
 */
export function parseDate(s: string): Date {
  if (/(Z|[+-]\d\d:?\d\d)$/.test(s)) return new Date(s);
  const m = s.match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d)(?::(\d\d))?)?$/);
  if (!m) return new Date(s);
  const [, y, mo, d, h = '0', mi = '0', sec = '0'] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
  const off1 = parisOffsetMinutes(new Date(guess));
  let utc = guess - off1 * 60000;
  const off2 = parisOffsetMinutes(new Date(utc));
  if (off2 !== off1) utc = guess - off2 * 60000;
  return new Date(utc);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `29 Oct 2026, 19:11` in Paris time. */
export function formatDate(date: Date): string {
  const p = parisParts(date);
  return `${+p.day} ${MONTHS[+p.month - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

/** `29 Oct, 19:11` for the block line. */
export function formatShort(date: Date): string {
  const p = parisParts(date);
  return `${+p.day} ${MONTHS[+p.month - 1]}, ${p.hour}:${p.minute}`;
}
