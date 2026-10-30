import { describe, it, expect } from 'vitest';
import { projectOf, ledger, readMinutes, dateRange, excerpt, kindsPresent, padTo, MISC, type Like } from './related';

const post = (id: string, when: string, things: string[] = [], kind: Like['kind'] = 'note', title = ''): Like => ({
  id,
  when: new Date(when),
  date: when,
  things,
  kind,
  title,
  plain: '',
});

// newest first, as loadPosts() returns them
const posts: Like[] = [
  post('p5', '2026-10-30T04:08:00+09:00', ['detourist'], 'set', 'Badges'),
  post('p4', '2026-10-29T20:06:00+01:00', ['ada'], 'note', 'Test from curl'),
  post('p3', '2026-10-29T19:11:00+01:00', ['ada'], 'photo'),
  post('p2', '2026-10-28T22:10:00+01:00', [], 'longread', 'Why this blog is a dump'),
  post('p1', '2026-10-26T17:40:00+01:00', ['detourist'], 'note'),
];

describe('projectOf — a post belongs to its first project, or to misc', () => {
  it('first project id, else misc', () => {
    expect(projectOf(posts[0])).toBe('detourist');
    expect(projectOf(posts[3])).toBe(MISC);
  });
});

describe('ledger — the latest posts of a project, always n rows', () => {
  it('fills the rows, newest first, and pads with blanks', () => {
    const rows = ledger(posts.filter((p) => projectOf(p) === 'ada'), 4);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ kind: 'Note', title: 'Test from curl' });
    expect(rows[1]).toMatchObject({ kind: 'Photo', title: '' });
    expect(rows[2]).toEqual({ kind: '', title: '', date: '', id: '' });
    expect(rows[3]).toEqual({ kind: '', title: '', date: '', id: '' });
  });
  it('cuts at n', () => {
    expect(ledger(posts, 2)).toHaveLength(2);
  });
});

describe('readMinutes — about 200 words a minute, never under one', () => {
  it('rounds up', () => {
    expect(readMinutes('one two three')).toBe(1);
    expect(readMinutes(Array(201).fill('w').join(' '))).toBe(2);
    expect(readMinutes(Array(1200).fill('w').join(' '))).toBe(6);
  });
});

describe('dateRange — oldest to newest, short', () => {
  it('two dates, or one when they are the same day', () => {
    expect(dateRange(posts.filter((p) => projectOf(p) === 'ada'))).toBe('29 Oct');
    expect(dateRange(posts)).toBe('26 Oct – 30 Oct');
    expect(dateRange([])).toBe('');
  });
});

describe('excerpt — about n characters, cut at a word, never the whole article', () => {
  it('short text untouched, long text cut with an ellipsis', () => {
    expect(excerpt('Hey folks, how are you.', 300)).toBe('Hey folks, how are you.');
    const long = Array(80).fill('word').join(' ');
    const e = excerpt(long, 50);
    expect(e.length).toBeLessThanOrEqual(51);
    expect(e.endsWith('…')).toBe(true);
    expect(e).not.toMatch(/ …$/);
  });
});

describe('kindsPresent — only the kinds that have posts, in the fixed order', () => {
  it('lists lanes with posts', () => {
    expect(kindsPresent(posts)).toEqual(['photos', 'sets', 'longreads', 'notes']);
    expect(kindsPresent(posts.filter((p) => projectOf(p) === 'ada'))).toEqual(['photos', 'notes']);
    expect(kindsPresent([])).toEqual([]);
  });
});

describe('padTo — the last row filled out', () => {
  it('pads to a multiple of n, never adds a full empty row', () => {
    expect(padTo(4, 3)).toBe(2);
    expect(padTo(6, 3)).toBe(0);
    expect(padTo(0, 3)).toBe(0);
    expect(padTo(1, 2)).toBe(1);
  });
});
