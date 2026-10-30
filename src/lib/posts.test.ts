import { describe, it, expect } from 'vitest';
import { kindOf, parseDate, formatDate, formatShort, toIsoInZone, wallParts, plain, LONGREAD_CHARS } from './posts';

describe('kindOf — inferred from what was dropped, never stored', () => {
  it('one image → photo, whatever text comes with it', () => {
    expect(kindOf({ images: 1, body: '' })).toBe('photo');
    expect(kindOf({ images: 1, body: 'x'.repeat(LONGREAD_CHARS + 50) })).toBe('photo');
  });
  it('several images → set', () => {
    expect(kindOf({ images: 2, body: '' })).toBe('set');
    expect(kindOf({ images: 5, body: 'three lines' })).toBe('set');
  });
  it('no images, long text → longread', () => {
    expect(kindOf({ images: 0, body: 'x'.repeat(LONGREAD_CHARS) })).toBe('longread');
  });
  it('no images, short text or a link → note', () => {
    expect(kindOf({ images: 0, body: 'Hey folks, how are you.' })).toBe('note');
    expect(kindOf({ images: 0, body: '', link: 'https://detouri.st' })).toBe('note');
    expect(kindOf({ images: 0, body: '' })).toBe('note');
  });
});

describe('toIsoInZone — the stored date is the wall clock where it was posted, with its offset', () => {
  it('writes local time + offset for the zone', () => {
    expect(toIsoInZone(new Date('2026-11-03T00:15:00Z'), 'Asia/Tokyo')).toBe('2026-11-03T09:15:00+09:00');
    expect(toIsoInZone(new Date('2026-10-29T18:11:00Z'), 'Europe/Paris')).toBe('2026-10-29T19:11:00+01:00');
    expect(toIsoInZone(new Date('2026-07-15T10:00:00Z'), 'Europe/Paris')).toBe('2026-07-15T12:00:00+02:00');
    expect(toIsoInZone(new Date('2026-07-15T10:00:00Z'), 'America/New_York')).toBe('2026-07-15T06:00:00-04:00');
    expect(toIsoInZone(new Date('2026-07-15T10:00:00Z'), 'UTC')).toBe('2026-07-15T10:00:00+00:00');
  });
});

describe('wallParts — read the stored string literally, never convert it', () => {
  it('keeps the wall clock of a string with an offset', () => {
    expect(wallParts('2026-11-03T09:15:00+09:00')).toMatchObject({ year: '2026', month: '11', day: '03', hour: '09', minute: '15' });
  });
  it('keeps a Keystatic-style local string as written', () => {
    expect(wallParts('2026-10-29T19:11')).toMatchObject({ year: '2026', month: '10', day: '29', hour: '19', minute: '11' });
  });
  it('reads a Z string as UTC wall clock', () => {
    expect(wallParts('2026-10-29T18:11:00Z')).toMatchObject({ hour: '18', minute: '11' });
  });
  it('reads a date-only string as midnight', () => {
    expect(wallParts('2026-06-04')).toMatchObject({ day: '04', hour: '00', minute: '00' });
  });
});

describe('parseDate — the instant, for sorting', () => {
  it('honours an explicit offset or Z', () => {
    expect(parseDate('2026-11-03T09:15:00+09:00').toISOString()).toBe('2026-11-03T00:15:00.000Z');
    expect(parseDate('2026-10-29T18:11:00Z').toISOString()).toBe('2026-10-29T18:11:00.000Z');
  });
  it('treats a string without a zone as Paris (older posts, Keystatic edits)', () => {
    expect(parseDate('2026-10-29T19:11').toISOString()).toBe('2026-10-29T18:11:00.000Z');
    expect(parseDate('2026-07-15T12:00').toISOString()).toBe('2026-07-15T10:00:00.000Z');
    expect(parseDate('2026-06-04').toISOString()).toBe('2026-06-03T22:00:00.000Z');
  });
});

describe('formatDate / formatShort — the block date line, as posted', () => {
  it('prints the wall clock of the stored string', () => {
    expect(formatDate('2026-11-03T09:15:00+09:00')).toBe('3 Nov 2026, 09:15');
    expect(formatDate('2026-10-29T19:11')).toBe('29 Oct 2026, 19:11');
    expect(formatShort('2026-11-03T09:15:00+09:00')).toBe('3 Nov, 09:15');
  });
});

describe('plain — the body as words only, for cells and lists', () => {
  it('drops images, keeps link labels, strips emphasis, headings, quotes and bullets', () => {
    const md = [
      '*A placeholder, from [The Elements of Drawing](https://www.gutenberg.org/ebooks/30325) (1857).*',
      '',
      '![a picture](../../assets/posts/x/1.jpg)',
      '',
      '## Exercise I',
      '',
      '> The pen should walk slowly.',
      '',
      '- a **steel** pen;',
      '- some `ink`.',
    ].join('\n');
    expect(plain(md)).toBe(
      ['A placeholder, from The Elements of Drawing (1857).', '', 'Exercise I', '', 'The pen should walk slowly.', '', 'a steel pen;', 'some ink.'].join('\n'),
    );
  });
  it('leaves plain text alone', () => {
    expect(plain('Hey folks, how are you.')).toBe('Hey folks, how are you.');
  });
});
