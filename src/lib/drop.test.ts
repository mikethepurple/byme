import { describe, it, expect } from 'vitest';
import { fitWithin, dropForm } from './drop';
import { parseMicropubRequest } from './micropub';

describe('fitWithin — a picture shrunk to fit, never enlarged', () => {
  it('keeps small pictures as they are', () => {
    expect(fitWithin(800, 600, 2400)).toEqual({ w: 800, h: 600 });
  });
  it('shrinks the long edge to the limit, keeping the shape', () => {
    expect(fitWithin(4032, 3024, 2400)).toEqual({ w: 2400, h: 1800 });
    expect(fitWithin(3024, 4032, 2400)).toEqual({ w: 1800, h: 2400 });
  });
});

const jpeg = (name: string) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], name, { type: 'image/jpeg' });
const post = (fd: FormData) => parseMicropubRequest(new Request('https://x/micropub', { method: 'POST', body: fd }));

describe('dropForm — what the drop page sends, as the publish endpoint reads it', () => {
  it('pictures only: no text, no project', async () => {
    const inc = await post(dropForm({ text: '', project: '', photos: [jpeg('a.jpg'), jpeg('b.jpg')], tz: 'Asia/Tokyo' }));
    expect(inc.photos).toHaveLength(2);
    expect(inc.content).toBe('');
    expect(inc.categories).toEqual([]);
    expect(inc.tz).toBe('Asia/Tokyo');
  });
  it('a picture with a caption and a picked project', async () => {
    const inc = await post(dropForm({ text: 'The canal at six.', project: 'detourist', photos: [jpeg('a.jpg')], tz: 'Europe/Paris' }));
    expect(inc.content).toBe('The canal at six.');
    expect(inc.categories).toEqual(['detourist']);
  });
  it('text only, with #tags typed in it', async () => {
    const inc = await post(dropForm({ text: 'An idea about #paper\n\n#experiments', project: '', photos: [], tz: 'Europe/Paris' }));
    expect(inc.categories).toEqual(expect.arrayContaining(['experiments', 'paper']));
    expect(inc.photos).toHaveLength(0);
  });
});
