// The publish path, pure parts. A Micropub request in any of its three
// encodings becomes one `Incoming`; `buildPost` turns it into the files one
// commit will carry. Nothing here touches the network.

import { HOME_ZONE, instantIn, toIsoInZone } from './posts';

export type Photo =
  | { kind: 'file'; name: string; type: string; data: Uint8Array }
  | { kind: 'url'; url: string }
  | { kind: 'path'; path: string }; // already in the repo (media endpoint inbox)

export interface Incoming {
  content: string;
  name: string;
  published?: string;
  tz?: string;
  categories: string[];
  photos: Photo[];
  link: string;
  /** What arrived, for the commit message: field names, types and short text values (never files or the key). */
  received?: string;
}

export class MicropubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function text(v: unknown): string {
  if (Array.isArray(v)) v = v[0];
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('html' in o) return String(o.html ?? '');
    if ('value' in o) return String(o.value ?? '');
    return '';
  }
  return v == null ? '' : String(v);
}

function texts(v: unknown): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map(text).filter((s) => s.length > 0);
}

/** iA Writer puts the title as the first `# heading`; it becomes the title, not body text. */
function splitTitle(raw: string, name: string): { name: string; content: string } {
  const content = raw.replace(/\r\n/g, '\n');
  const m = content.match(/^\s*#+ (.+)/);
  if (m) return { name: m[1].trim(), content: content.replace(/^\s*#+ .+\n*/, '').trim() };
  return { name: name.trim(), content: content.trim() };
}

export async function parseMicropubRequest(req: Request): Promise<Incoming> {
  const ct = req.headers.get('content-type') ?? '';
  const inc: Incoming = { content: '', name: '', categories: [], photos: [], link: '' };

  if (ct.includes('application/json')) {
    const body = (await req.json()) as { type?: string[]; properties?: Record<string, unknown> };
    const types = body.type ?? ['h-entry'];
    if (!types.includes('h-entry')) throw new MicropubError(400, 'Unsupported type');
    const p = body.properties ?? {};
    const t = splitTitle(text(p.content), text(p.name));
    inc.name = t.name;
    inc.content = t.content;
    inc.published = text(p.published) || undefined;
    inc.tz = text(p.tz) || undefined;
    inc.categories = texts(p.category);
    const jt = splitTags(inc.content);
    inc.content = jt.content;
    inc.categories.push(...jt.tags);
    inc.link = text(p['bookmark-of']) || '';
    inc.photos = texts(p.photo).map((url) => ({ kind: 'url', url }));
    const li = liftImages(inc.content, inc.name);
    inc.content = li.content;
    inc.name = li.name;
    inc.photos.push(...li.urls.map((url) => ({ kind: 'url' as const, url })));
    return inc;
  }

  // application/x-www-form-urlencoded and multipart/form-data both read as FormData.
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    throw new MicropubError(400, 'Body must be JSON, form-urlencoded or multipart');
  }
  // iOS Shortcuts can send a text field (category, content) as a small text
  // file part; read those as text. Pictures stay files.
  const raw = fd;
  fd = new FormData();
  inc.received = [...raw.entries()]
    .map(([k, v]) => (typeof v === 'string' ? `${k}=${JSON.stringify(v.slice(0, 40))}` : `${k}:file(${v.type || '?'},${v.size}b)`))
    .join(' ');
  for (const [k, v] of raw.entries()) {
    const base = k.replace(/\[\]$/, '');
    if (typeof v !== 'string' && base !== 'photo' && v.size < 64_000 && !/^image\//.test(v.type)) {
      fd.append(k, (await v.text()).trim());
    } else {
      fd.append(k, v);
    }
  }
  const h = fd.get('h');
  if (h && h !== 'entry') throw new MicropubError(400, 'Unsupported type');
  const str = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' ? v : '';
  };
  const all = (k: string) => [...fd.getAll(k), ...fd.getAll(`${k}[]`)];
  const t = splitTitle(str('content'), str('name'));
  inc.name = t.name;
  inc.content = t.content;
  inc.published = str('published') || undefined;
  inc.tz = str('tz') || undefined;
  inc.categories = all('category').filter((v): v is string => typeof v === 'string' && v.length > 0);
  const ft = splitTags(inc.content);
  inc.content = ft.content;
  inc.categories.push(...ft.tags);
  inc.link = str('bookmark-of') || '';
  for (const v of all('photo')) {
    if (typeof v === 'string') {
      if (v) inc.photos.push({ kind: 'url', url: v });
    } else if (v.size > 0) {
      inc.photos.push({ kind: 'file', name: v.name, type: v.type, data: new Uint8Array(await v.arrayBuffer()) });
    }
  }
  const li = liftImages(inc.content, inc.name);
  inc.content = li.content;
  inc.name = li.name;
  inc.photos.push(...li.urls.map((url) => ({ kind: 'url' as const, url })));
  return inc;
}

function validZone(z?: string): string | undefined {
  if (!z) return undefined;
  try {
    new Intl.DateTimeFormat('en', { timeZone: z });
    return z;
  } catch {
    return undefined;
  }
}

const WITH_OFFSET = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d)(?::(\d\d))?(Z|[+-]\d\d):?(\d\d)?$/;

/**
 * The date string stored in the post: the wall clock where it was posted, with
 * its offset. An explicit `published` with an offset wins; a `published` without
 * one is read in the client's `tz`; otherwise "now" in `tz`, then in the zone the
 * request came from (Cloudflare's `request.cf.timezone`), then Paris.
 */
export function storedDateFor(inc: { published?: string; tz?: string }, now: Date, requestZone?: string): string {
  const zone = validZone(inc.tz) ?? validZone(requestZone) ?? HOME_ZONE;
  const pub = inc.published?.trim();
  if (pub) {
    const m = pub.match(WITH_OFFSET);
    if (m) {
      const [, day, hm, sec = '00', z, mm] = m;
      if (z === 'Z') return `${day}T${hm}:${sec}Z`;
      return `${day}T${hm}:${sec}${z}:${mm ?? '00'}`;
    }
    const inst = instantIn(pub, zone);
    if (!Number.isNaN(inst.getTime())) return toIsoInZone(inst, zone);
  }
  return toIsoInZone(now, zone);
}

const IMAGE_EXT: Record<string, string> = { jpg: 'jpg', jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };
const IMAGE_TYPE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function extOf(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase();
}

/** JPEG, PNG, WebP, GIF only. HEIC is refused: the build's image service cannot read it. */
export function isAllowedImage(type: string, name: string): boolean {
  const ext = extOf(name);
  if (type === 'image/heic' || type === 'image/heif' || ext === 'heic' || ext === 'heif') return false;
  return type in IMAGE_TYPE || ext in IMAGE_EXT;
}

function imageExt(type: string, name: string): string {
  return IMAGE_EXT[extOf(name)] ?? IMAGE_TYPE[type] ?? 'jpg';
}

/** A URL the media endpoint handed out maps back to the file's path in the repo. */
export function inboxPathFromUrl(url: string, repo: string): string | null {
  const m = url.match(new RegExp(`^https://raw\\.githubusercontent\\.com/${repo}/[^/]+/(src/assets/inbox/[^/?#]+)$`));
  return m ? m[1] : null;
}

export interface PostInput {
  slug: string;
  date: string;
  name: string;
  content: string;
  things: string[];
  link: string;
  photos: Photo[];
}

export interface FileEntry {
  path: string;
  content: string | Uint8Array;
}

function yamlString(s: string): string {
  return s ? JSON.stringify(s) : "''";
}

function yamlList(key: string, items: string[]): string {
  if (items.length === 0) return `${key}: []`;
  return [`${key}:`, ...items.map((i) => `  - ${i}`)].join('\n');
}

/** The `.mdoc` and its image files, in the layout the pages and Keystatic read. */
export function buildPost(input: PostInput): { files: FileEntry[] } {
  const files: FileEntry[] = [];
  const images: string[] = [];
  let n = 0;
  for (const photo of input.photos) {
    if (photo.kind === 'file') {
      n += 1;
      const path = `src/assets/posts/${input.slug}/${n}.${imageExt(photo.type, photo.name)}`;
      files.push({ path, content: photo.data });
      images.push(`/${path}`);
    } else if (photo.kind === 'path') {
      images.push(`/${photo.path}`);
    } else {
      throw new MicropubError(400, `Photo URL not supported: ${photo.url}`);
    }
  }

  const front = [
    '---',
    `date: '${input.date}'`,
    `title: ${yamlString(input.name)}`,
    yamlList('things', input.things),
    yamlList('images', images),
    `link: ${input.link ? input.link : "''"}`,
    'draft: false',
    '---',
  ].join('\n');
  const body = input.content.trim();
  files.push({ path: `src/content/posts/${input.slug}.mdoc`, content: body ? `${front}\n\n${body}\n` : `${front}\n` });
  return { files };
}

/** The project tags a client may use (`?q=category`), from the things files' paths. */
export function categoryList(paths: string[]): string[] {
  return paths.map((p) => p.split('/').pop()!.replace(/\.yaml$/, '')).sort();
}

/**
 * A last line made only of #tags ("#ada", "#ada #manga") is the post's
 * projects, not its text: iA Writer sends tags typed in the body as text.
 * Hashtags inside a sentence stay where they are.
 */
export function splitTags(content: string): { content: string; tags: string[] } {
  const lines = content.replace(/\s+$/, '').split('\n');
  const last = lines[lines.length - 1]?.trim() ?? '';
  if (!/^(#[\p{L}\p{N}_-]+\s*)+$/u.test(last)) return { content: content.trim(), tags: [] };
  const tags = last.split(/\s+/).map((t) => t.slice(1).toLowerCase());
  return { content: lines.slice(0, -1).join('\n').trim(), tags };
}

const IMG_MD = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const IMG_HTML = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
const FILE_TITLE = /^[\w .()-]+\.(png|jpe?g|gif|webp|heic|heif|tiff?)$/i;

/**
 * iA Writer uploads pictures to the media endpoint and puts them in the text.
 * Pictures that open the text (blocks made only of pictures, before any words)
 * become the post's own pictures, so a picture post is a Photo or a Set; what
 * follows is the caption. A title that is just a file name ("IMG_0471.PNG")
 * goes. Pictures inside a text that starts with words stay where they are.
 */
export function liftImages(content: string, name: string): { content: string; name: string; urls: string[] } {
  const blocks = content.split(/\n\s*\n/);
  const urls: string[] = [];
  let i = 0;
  for (; i < blocks.length; i++) {
    const b = blocks[i].trim();
    if (!b) continue;
    const found = [...b.matchAll(IMG_MD), ...b.matchAll(IMG_HTML)].map((m) => m[1]);
    const rest = b.replace(IMG_MD, '').replace(IMG_HTML, '').replace(/<\/?p>/gi, '').trim();
    if (found.length === 0 || rest) break;
    urls.push(...found);
  }
  if (urls.length === 0) return { content, name, urls };
  return {
    content: blocks.slice(i).join('\n\n').trim(),
    name: FILE_TITLE.test(name.trim()) ? '' : name,
    urls,
  };
}
