import { describe, it, expect } from 'vitest';
import { frontCells, similar, type Like } from './related';

const post = (id: string, when: string, things: string[] = [], pinned = false): Like => ({
  id,
  when: new Date(when),
  things,
  pinned,
});

// newest first, as loadPosts() returns them
const posts: Like[] = [
  post('p5', '2026-10-30T04:08:00Z', ['detourist']),
  post('p4', '2026-10-29T20:06:00Z', ['ada']),
  post('p3', '2026-10-29T19:11:00Z', ['ada'], true),
  post('p2', '2026-10-28T22:10:00Z', [], true),
  post('p1', '2026-10-26T17:40:00Z', ['detourist']),
];
const things = [{ id: 'ada' }, { id: 'detourist' }, { id: 'manga' }];

describe('frontCells — the front grid: the projects, then what he pinned', () => {
  it('projects in their order, then pinned posts newest first', () => {
    const cells = frontCells(things, posts);
    expect(cells.map((c) => (c.kind === 'thing' ? `thing:${c.thing.id}` : `post:${c.post.id}`))).toEqual([
      'thing:ada',
      'thing:detourist',
      'thing:manga',
      'post:p3',
      'post:p2',
    ]);
  });
  it('nothing pinned → just the projects', () => {
    const cells = frontCells(things, posts.map((p) => ({ ...p, pinned: false })));
    expect(cells).toHaveLength(3);
  });
});

describe('similar — the posts shown beside an open one', () => {
  it('the same project first, newest first, never the post itself', () => {
    expect(similar(posts[1], posts, 6).map((p) => p.id)).toEqual(['p3', 'p5', 'p2', 'p1']);
  });
  it('no project → the nearest by date on either side', () => {
    expect(similar(posts[3], posts, 2).map((p) => p.id)).toEqual(['p3', 'p1']);
  });
  it('stops at n', () => {
    expect(similar(posts[0], posts, 1).map((p) => p.id)).toEqual(['p1']);
  });
});
