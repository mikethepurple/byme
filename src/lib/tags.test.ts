import { describe, it, expect } from 'vitest';
import { normalizeTag, splitCategories, tagsPresent, withTag } from './tags';
import { buildPost } from './micropub';

describe('normalizeTag — one form for a tag, however it was typed', () => {
  it('drops the #, lowercases, keeps letters, digits and dashes', () => {
    expect(normalizeTag('#Idea')).toBe('idea');
    expect(normalizeTag(' Side Quest ')).toBe('side-quest');
    expect(normalizeTag('long_read')).toBe('long-read');
    expect(normalizeTag('#Эскиз')).toBe('эскиз');
    expect(normalizeTag('what?!')).toBe('what');
  });
  it('gives nothing for a tag with no letters or digits', () => {
    expect(normalizeTag('#')).toBe('');
    expect(normalizeTag(' - ')).toBe('');
  });
});

describe('splitCategories — project names become the project, the rest become tags', () => {
  const projects = ['ada', 'detourist', 'experiments', 'manga'];
  it('keeps tags that are not projects instead of dropping them', () => {
    expect(splitCategories(['experiments', 'idea', 'Side Quest'], projects)).toEqual({ things: ['experiments'], tags: ['idea', 'side-quest'] });
  });
  it('drops misc, empties and repeats', () => {
    expect(splitCategories(['misc', '#', 'idea', '#Idea', 'ada', 'ADA'], projects)).toEqual({ things: ['ada'], tags: ['idea'] });
  });
  it('keeps the order he typed', () => {
    expect(splitCategories(['zeta', 'manga', 'alpha'], projects)).toEqual({ things: ['manga'], tags: ['zeta', 'alpha'] });
  });
});

const like = (id: string, tags: string[]) => ({ id, data: { tags } });

describe('tagsPresent — the tags in force, most used first, then a–z', () => {
  it('counts and orders', () => {
    expect(tagsPresent([like('a', ['idea', 'paper']), like('b', ['paper']), like('c', [])])).toEqual(['paper', 'idea']);
    expect(tagsPresent([like('a', ['b']), like('b', ['a'])])).toEqual(['a', 'b']);
    expect(tagsPresent([])).toEqual([]);
  });
});

describe('withTag — the posts carrying a tag', () => {
  it('filters', () => {
    const ps = [like('a', ['idea']), like('b', ['paper']), like('c', ['idea', 'paper'])];
    expect(withTag(ps, 'idea').map((p) => p.id)).toEqual(['a', 'c']);
  });
});

describe('buildPost — writes the tags into the post', () => {
  it('a tags list in the front matter', () => {
    const { files } = buildPost({ slug: 's', date: '2026-11-04T10:00:00+01:00', name: '', content: 'Hi', things: ['experiments'], tags: ['idea', 'эскиз'], link: '', photos: [] });
    const mdoc = files[0].content as string;
    expect(mdoc).toContain('things:\n  - experiments');
    expect(mdoc).toContain('tags:\n  - idea\n  - эскиз');
  });
  it('a tag YAML would read as a number or a yes/no stays a string', () => {
    const { files } = buildPost({ slug: 's', date: '2026-11-04T10:00:00+01:00', name: '', content: 'Hi', things: [], tags: ['2026', 'no', 'idea'], link: '', photos: [] });
    expect(files[0].content as string).toContain('tags:\n  - "2026"\n  - "no"\n  - idea');
  });
  it('an empty list when there are none', () => {
    const { files } = buildPost({ slug: 's', date: '2026-11-04T10:00:00+01:00', name: '', content: 'Hi', things: [], tags: [], link: '', photos: [] });
    expect(files[0].content as string).toContain('tags: []');
  });
});

import { inlineTags } from './tags';
import { parseMicropubRequest } from './micropub';

describe('inlineTags — #words anywhere in the text are tags too; the text keeps them', () => {
  it('finds hashtags in sentences', () => {
    expect(inlineTags('Trying a #paper prototype for #Ada today.')).toEqual(['paper', 'ada']);
    expect(inlineTags('#idea first thing')).toEqual(['idea']);
    expect(inlineTags('Набросок #эскиз')).toEqual(['эскиз']);
  });
  it('ignores headings, numbers, link anchors and code', () => {
    expect(inlineTags('# A heading\n\n## Another')).toEqual([]);
    expect(inlineTags('Issue #12 is fixed')).toEqual([]);
    expect(inlineTags('See https://x.com/page#section and [a](/b#c)')).toEqual([]);
    expect(inlineTags('Run `git log #nope` and\n\n```\n#notatag\n```\n')).toEqual([]);
  });
});

describe('a post from any client: inline #tags reach the categories', () => {
  it('JSON (iA Writer)', async () => {
    const req = new Request('https://x/micropub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: ['h-entry'], properties: { content: ['A #paper sketch for #experiments.'] } }),
    });
    const inc = await parseMicropubRequest(req);
    expect(inc.content).toBe('A #paper sketch for #experiments.');
    expect(inc.categories).toEqual(expect.arrayContaining(['paper', 'experiments']));
  });
  it('form (Shortcut)', async () => {
    const fd = new FormData();
    fd.append('h', 'entry');
    fd.append('content', 'Shot on the walk #detourist #light');
    const inc = await parseMicropubRequest(new Request('https://x/micropub', { method: 'POST', body: fd }));
    expect(inc.categories).toEqual(expect.arrayContaining(['detourist', 'light']));
  });
});

describe('splitCategories — a Shortcut variable that never resolved is not a tag', () => {
  it('drops Shortcuts placeholder names like "Chosen Item" (04.11: #chosen-item from the iPhone)', async () => {
    const { splitCategories } = await import('./tags');
    expect(splitCategories(['Chosen Item', 'Shortcut Input', 'Provided Input', 'Ask for Input', 'Text', 'ada', 'sncf'], ['ada'])).toEqual({ things: ['ada'], tags: ['sncf'] });
  });
});
