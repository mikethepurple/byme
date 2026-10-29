import { describe, it, expect } from 'vitest';
import { slugFor } from './slug';

describe('slugFor — timestamp slugs, Paris time, no title needed', () => {
  it('is YYYY-MM-DD-HHMM in Europe/Paris', () => {
    expect(slugFor(new Date('2026-10-29T18:11:00Z'), [])).toBe('2026-10-29-1911');
    expect(slugFor(new Date('2026-07-15T10:00:00Z'), [])).toBe('2026-07-15-1200');
  });
  it('rolls the date over at Paris midnight, not UTC midnight', () => {
    expect(slugFor(new Date('2026-10-29T23:30:00Z'), [])).toBe('2026-10-30-0030');
  });
  it('appends -2, -3 when the minute is taken', () => {
    const taken = ['2026-10-29-1911'];
    expect(slugFor(new Date('2026-10-29T18:11:00Z'), taken)).toBe('2026-10-29-1911-2');
    expect(slugFor(new Date('2026-10-29T18:11:00Z'), [...taken, '2026-10-29-1911-2'])).toBe(
      '2026-10-29-1911-3',
    );
  });
});
