import { describe, it, expect } from 'vitest';
import { slugFor } from './slug';

describe('slugFor — timestamp slugs from the stored date, wall clock where it was posted', () => {
  it('is YYYY-MM-DD-HHMM of the stored string, whatever its offset', () => {
    expect(slugFor('2026-10-29T19:11:00+01:00', [])).toBe('2026-10-29-1911');
    expect(slugFor('2026-11-03T09:15:00+09:00', [])).toBe('2026-11-03-0915');
    expect(slugFor('2026-07-15T06:00:00-04:00', [])).toBe('2026-07-15-0600');
  });
  it('takes a zone-less string as written', () => {
    expect(slugFor('2026-10-29T19:11', [])).toBe('2026-10-29-1911');
  });
  it('appends -2, -3 when the minute is taken', () => {
    const taken = ['2026-10-29-1911'];
    expect(slugFor('2026-10-29T19:11:00+01:00', taken)).toBe('2026-10-29-1911-2');
    expect(slugFor('2026-10-29T19:11:00+01:00', [...taken, '2026-10-29-1911-2'])).toBe('2026-10-29-1911-3');
  });
});
