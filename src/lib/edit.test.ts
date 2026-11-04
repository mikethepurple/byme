import { describe, it, expect } from 'vitest';
import { editRow, keystaticUrl } from './edit';

const p = (o: Partial<Parameters<typeof editRow>[0]> = {}) => ({
  id: '2026-11-04-1326', date: '2026-11-04T13:26:05+01:00', kind: 'photo' as const, title: '', plain: '', images: 1, things: [] as string[], tags: [] as string[], ...o,
});

describe('keystaticUrl — a post opens in the editor', () => {
  it('points at the item on main', () => {
    expect(keystaticUrl('2026-11-04-1326')).toBe('/keystatic/branch/main/collection/posts/item/2026-11-04-1326');
  });
});

describe('editRow — one readable line per post', () => {
  it('a captioned photo in a project', () => {
    const r = editRow(p({ plain: 'Built this for myself today #sncf', things: ['experiments'], tags: ['sncf'] }), new Map([['experiments', 'Experiments']]));
    expect(r).toMatchObject({ kind: 'Photo', project: 'Experiments', tags: '#sncf', headline: 'Built this for myself today #sncf', when: '4 Nov, 13:26', edit: '/keystatic/branch/main/collection/posts/item/2026-11-04-1326', view: '/2026-11-04-1326' });
  });
  it('an untitled photo with no text says what it is', () => {
    expect(editRow(p(), new Map()).headline).toBe('Photo');
    expect(editRow(p(), new Map()).project).toBe('misc');
  });
  it('a one-line note: its line; a longread: its title and an excerpt', () => {
    expect(editRow(p({ kind: 'note', images: 0, plain: 'Test' }), new Map()).headline).toBe('Test');
    const r = editRow(p({ kind: 'longread', images: 0, title: 'Pens', plain: 'And no, it is not going to take your job. '.repeat(20) }), new Map());
    expect(r.headline).toBe('Pens');
    expect(r.excerpt.length).toBeLessThanOrEqual(141);
  });
});
