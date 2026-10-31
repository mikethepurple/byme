import { describe, it, expect } from 'vitest';
import { liftImages, splitTags, categoryList, parseMicropubRequest, storedDateFor, buildPost, isAllowedImage, inboxPathFromUrl } from './micropub';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('parseMicropubRequest — three encodings, one post model', () => {
  it('reads the JSON shape iA Writer sends, title from the first heading', async () => {
    const req = new Request('https://by.erikov.me/micropub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: ['h-entry'],
        properties: { content: [{ html: '# Hello\n\nFirst line.' }], category: ['ada'] },
      }),
    });
    const inc = await parseMicropubRequest(req);
    expect(inc.name).toBe('Hello');
    expect(inc.content).toBe('First line.');
    expect(inc.categories).toEqual(['ada']);
    expect(inc.photos).toEqual([]);
  });

  it('reads JSON with a plain content string, published and photo URLs', async () => {
    const req = new Request('https://by.erikov.me/micropub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: ['h-entry'],
        properties: {
          content: ['three lines'],
          published: ['2026-11-03T09:15:00+09:00'],
          photo: ['https://raw.githubusercontent.com/mikethepurple/byme/redo/src/assets/inbox/a.jpg'],
        },
      }),
    });
    const inc = await parseMicropubRequest(req);
    expect(inc.content).toBe('three lines');
    expect(inc.published).toBe('2026-11-03T09:15:00+09:00');
    expect(inc.photos).toEqual([{ kind: 'url', url: 'https://raw.githubusercontent.com/mikethepurple/byme/redo/src/assets/inbox/a.jpg' }]);
  });

  it('reads form-urlencoded with category[] and bookmark-of', async () => {
    const body = new URLSearchParams();
    body.append('h', 'entry');
    body.append('content', 'The site is up.');
    body.append('category[]', 'detourist');
    body.append('category[]', 'ada');
    body.append('bookmark-of', 'https://detouri.st');
    body.append('tz', 'Asia/Tokyo');
    const req = new Request('https://by.erikov.me/micropub', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const inc = await parseMicropubRequest(req);
    expect(inc.categories).toEqual(['detourist', 'ada']);
    expect(inc.link).toBe('https://detouri.st');
    expect(inc.tz).toBe('Asia/Tokyo');
  });

  it('reads multipart with one photo file and no text (the normal case)', async () => {
    const fd = new FormData();
    fd.append('h', 'entry');
    fd.append('photo', new File([png], 'IMG_0001.PNG', { type: 'image/png' }));
    const req = new Request('https://by.erikov.me/micropub', { method: 'POST', body: fd });
    const inc = await parseMicropubRequest(req);
    expect(inc.content).toBe('');
    expect(inc.photos).toHaveLength(1);
    expect(inc.photos[0]).toMatchObject({ kind: 'file', name: 'IMG_0001.PNG', type: 'image/png' });
  });

  it('reads multipart with photo[] files, category[] and content', async () => {
    const fd = new FormData();
    fd.append('h', 'entry');
    fd.append('content', 'two badges');
    fd.append('category[]', 'detourist');
    fd.append('photo[]', new File([png], 'a.png', { type: 'image/png' }));
    fd.append('photo[]', new File([png], 'b.jpg', { type: 'image/jpeg' }));
    const req = new Request('https://by.erikov.me/micropub', { method: 'POST', body: fd });
    const inc = await parseMicropubRequest(req);
    expect(inc.photos.map((p) => (p.kind === 'file' ? p.name : p.url))).toEqual(['a.png', 'b.jpg']);
    expect(inc.categories).toEqual(['detourist']);
    expect(inc.content).toBe('two badges');
  });
});

describe('storedDateFor — the wall clock where it was posted', () => {
  const now = new Date('2026-11-03T00:15:00Z');
  it('keeps an explicit published with offset', () => {
    expect(storedDateFor({ published: '2026-11-03T09:15:00+09:00' }, now, 'Europe/Paris')).toBe('2026-11-03T09:15:00+09:00');
  });
  it('reads a published without offset in the given tz', () => {
    expect(storedDateFor({ published: '2026-11-03T09:15', tz: 'Asia/Tokyo' }, now, 'Europe/Paris')).toBe('2026-11-03T09:15:00+09:00');
  });
  it('uses tz, then the request zone, then Paris, for "now"', () => {
    expect(storedDateFor({ tz: 'Asia/Tokyo' }, now, 'Europe/Paris')).toBe('2026-11-03T09:15:00+09:00');
    expect(storedDateFor({}, now, 'America/New_York')).toBe('2026-11-02T19:15:00-05:00');
    expect(storedDateFor({}, now, undefined)).toBe('2026-11-03T01:15:00+01:00');
  });
  it('ignores an unknown zone name', () => {
    expect(storedDateFor({ tz: 'Mars/Olympus' }, now, 'Nonsense/Zone')).toBe('2026-11-03T01:15:00+01:00');
  });
});

describe('isAllowedImage — HEIC is refused, the Shortcut converts first', () => {
  it('accepts jpeg, png, webp, gif by type or extension', () => {
    expect(isAllowedImage('image/jpeg', 'x.jpg')).toBe(true);
    expect(isAllowedImage('application/octet-stream', 'x.PNG')).toBe(true);
    expect(isAllowedImage('image/webp', 'x.webp')).toBe(true);
    expect(isAllowedImage('image/gif', 'x.gif')).toBe(true);
  });
  it('refuses heic/heif and anything else', () => {
    expect(isAllowedImage('image/heic', 'IMG_1.HEIC')).toBe(false);
    expect(isAllowedImage('application/octet-stream', 'IMG_1.heif')).toBe(false);
    expect(isAllowedImage('video/mp4', 'clip.mp4')).toBe(false);
  });
});

describe('inboxPathFromUrl — a media-endpoint URL maps back to its repo path', () => {
  it('maps our raw GitHub URL', () => {
    expect(inboxPathFromUrl('https://raw.githubusercontent.com/mikethepurple/byme/redo/src/assets/inbox/1762128900-a.jpg', 'mikethepurple/byme')).toBe('src/assets/inbox/1762128900-a.jpg');
  });
  it('returns null for anything else', () => {
    expect(inboxPathFromUrl('https://example.com/a.jpg', 'mikethepurple/byme')).toBeNull();
  });
});

describe('buildPost — one .mdoc plus its image files, in the layout Keystatic reads', () => {
  it('writes frontmatter with only what was given and numbers the images', () => {
    const out = buildPost({
      slug: '2026-11-03-0915',
      date: '2026-11-03T09:15:00+09:00',
      name: '',
      content: 'two badges',
      things: ['detourist'],
      link: '',
      photos: [
        { kind: 'file', name: 'a.png', type: 'image/png', data: png },
        { kind: 'file', name: 'b.JPG', type: 'image/jpeg', data: png },
      ],
    });
    expect(out.files.map((f) => f.path)).toEqual([
      'src/assets/posts/2026-11-03-0915/1.png',
      'src/assets/posts/2026-11-03-0915/2.jpg',
      'src/content/posts/2026-11-03-0915.mdoc',
    ]);
    const mdoc = out.files[2].content as string;
    expect(mdoc).toBe(
      [
        '---',
        "date: '2026-11-03T09:15:00+09:00'",
        "title: ''",
        'things:',
        '  - detourist',
        'images:',
        '  - /src/assets/posts/2026-11-03-0915/1.png',
        '  - /src/assets/posts/2026-11-03-0915/2.jpg',
        "link: ''",
        'draft: false',
        '---',
        '',
        'two badges',
        '',
      ].join('\n'),
    );
  });

  it('references an inbox image in place instead of copying it', () => {
    const out = buildPost({
      slug: '2026-11-03-0915',
      date: '2026-11-03T09:15:00+09:00',
      name: 'A title with "quotes"',
      content: '',
      things: [],
      link: 'https://detouri.st',
      photos: [{ kind: 'path', path: 'src/assets/inbox/1762128900-a.jpg' }],
    });
    expect(out.files.map((f) => f.path)).toEqual(['src/content/posts/2026-11-03-0915.mdoc']);
    const mdoc = out.files[0].content as string;
    expect(mdoc).toContain('title: "A title with \\"quotes\\""');
    expect(mdoc).toContain('  - /src/assets/inbox/1762128900-a.jpg');
    expect(mdoc).toContain('link: https://detouri.st');
    expect(mdoc).toContain('things: []');
  });
});

describe('categoryList — the project tags a client may use, from the things files', () => {
  it('slugs from file paths, sorted, without the folder or extension', () => {
    expect(categoryList(['/src/content/things/manga.yaml', '/src/content/things/ada.yaml', '/src/content/things/detourist.yaml'])).toEqual(['ada', 'detourist', 'manga']);
    expect(categoryList([])).toEqual([]);
  });
});

describe('trailing hashtags — a last line of #tags is the project, not text', () => {
  it('moves #ada on its own last line into categories and drops it from the text', () => {
    expect(splitTags('Body text.\n\n#ada')).toEqual({ content: 'Body text.', tags: ['ada'] });
    expect(splitTags('Body.\n\n#ada #Manga\n')).toEqual({ content: 'Body.', tags: ['ada', 'manga'] });
  });
  it('leaves hashtags inside the text alone', () => {
    expect(splitTags('I like #ada a lot.')).toEqual({ content: 'I like #ada a lot.', tags: [] });
    expect(splitTags('No tags here.')).toEqual({ content: 'No tags here.', tags: [] });
  });
  it('a JSON post with a trailing #ada lands in categories', async () => {
    const req = new Request('https://x/micropub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: ['h-entry'], properties: { content: ['Hello.\n\n#ada'] } }),
    });
    const inc = await parseMicropubRequest(req);
    expect(inc.content).toBe('Hello.');
    expect(inc.categories).toContain('ada');
  });
});

describe('liftImages — pictures iA Writer puts in the text become the post\'s pictures', () => {
  const url = 'https://raw.githubusercontent.com/mikethepurple/byme/main/src/assets/inbox/1793375733-img-0471.png';
  it('an image-only body: the picture is lifted out, the body is empty, a file-name title goes', () => {
    expect(liftImages(`![](${url})`, 'IMG_0471.PNG')).toEqual({ content: '', name: '', urls: [url] });
  });
  it('several pictures and a caption: all lifted, the caption stays, a real title stays', () => {
    const r = liftImages(`![](${url})\n\n![a](${url}?2)\n\nThe canal at dawn.`, 'Morning');
    expect(r.urls).toEqual([url, `${url}?2`]);
    expect(r.content).toBe('The canal at dawn.');
    expect(r.name).toBe('Morning');
  });
  it('a picture inside a longer text stays in the text', () => {
    const body = `First paragraph.\n\n![](${url})\n\nSecond paragraph.`;
    expect(liftImages(body, 'Essay')).toEqual({ content: body, name: 'Essay', urls: [] });
  });
  it('html <img> as well as markdown', () => {
    expect(liftImages(`<p><img src="${url}" alt=""></p>`, '').urls).toEqual([url]);
  });
});

describe('cleanKey — the publishing key survives what notes and password managers add', () => {
  it('drops spaces, invisible characters and non-hex letters', async () => {
    const { cleanKey } = await import('./env');
    const k = '3d20ada367d60e0159056837b1e64ab371f34a559b0a1d11f7abc1fe27cebe9c';
    expect(cleanKey(` ${k}\n`)).toBe(k);
    expect(cleanKey(`${k}x`)).toBe(k);
    expect(cleanKey(`​${k} `)).toBe(k);
  });
});

describe('a Shortcut form — text fields sent as file parts still count', () => {
  it('reads category (and content) from a small text file part', async () => {
    const fd = new FormData();
    fd.append('photo[]', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' }));
    fd.append('category', new File(['detourist'], 'text.txt', { type: 'text/plain' }));
    fd.append('content', new File(['A caption'], 'text.txt', { type: 'text/plain' }));
    const inc = await parseMicropubRequest(new Request('https://x/micropub', { method: 'POST', body: fd }));
    expect(inc.categories).toEqual(['detourist']);
    expect(inc.content).toBe('A caption');
    expect(inc.photos).toHaveLength(1);
  });
});

describe('htmlToMarkdown — iA Writer may publish HTML instead of Markdown', () => {
  it('paragraphs, headings, links, emphasis, pictures, entities', async () => {
    const { htmlToMarkdown } = await import('./micropub');
    expect(htmlToMarkdown('<p>Тест</p>')).toBe('Тест');
    expect(htmlToMarkdown('<h1>This is an app</h1>\n\n<p>Thst ill launch</p>')).toBe('# This is an app\n\nThst ill launch');
    expect(htmlToMarkdown('<p>A <a href="https://x.y">link</a> and <em>this</em> &amp; <strong>that</strong></p><p>Two<br>lines</p>')).toBe('A [link](https://x.y) and *this* & **that**\n\nTwo\nlines');
    expect(htmlToMarkdown('<p><img src="https://r/1.png" alt="a"></p>')).toBe('![a](https://r/1.png)');
    expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('- one\n- two');
  });
  it('leaves Markdown alone', async () => {
    const { htmlToMarkdown } = await import('./micropub');
    expect(htmlToMarkdown('Plain *text* with <3')).toBe('Plain *text* with <3');
  });
  it('a JSON post in HTML gets its h1 as the title and Markdown as the body', async () => {
    const req = new Request('https://x/micropub', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: ['h-entry'], properties: { content: [{ html: '<h1>This is an app</h1><p>It will launch</p>' }] } }) });
    const inc = await parseMicropubRequest(req);
    expect(inc.name).toBe('This is an app');
    expect(inc.content).toBe('It will launch');
  });
});
