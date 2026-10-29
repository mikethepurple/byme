import { describe, it, expect } from 'vitest';
import { kindOf, parseDate, formatDate, LONGREAD_CHARS } from './posts';

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

describe('parseDate — Paris time when the stored string has no offset', () => {
  it('reads a Keystatic-style local datetime as Europe/Paris', () => {
    // 29 Oct 2026 19:11 Paris = 18:11 UTC (CET, UTC+1 after the 25 Oct change)
    expect(parseDate('2026-10-29T19:11').toISOString()).toBe('2026-10-29T18:11:00.000Z');
    // 15 Jul 2026 12:00 Paris = 10:00 UTC (CEST, UTC+2)
    expect(parseDate('2026-07-15T12:00').toISOString()).toBe('2026-07-15T10:00:00.000Z');
  });
  it('keeps an explicit offset or Z as given', () => {
    expect(parseDate('2026-10-29T19:11:00+01:00').toISOString()).toBe('2026-10-29T18:11:00.000Z');
    expect(parseDate('2026-10-29T18:11:00Z').toISOString()).toBe('2026-10-29T18:11:00.000Z');
  });
  it('accepts a date-only string as midnight Paris', () => {
    expect(parseDate('2026-06-04').toISOString()).toBe('2026-06-03T22:00:00.000Z');
  });
});

describe('formatDate — the block date line, Paris time', () => {
  it('prints day, month, time', () => {
    expect(formatDate(parseDate('2026-10-29T19:11'))).toBe('29 Oct 2026, 19:11');
  });
});
