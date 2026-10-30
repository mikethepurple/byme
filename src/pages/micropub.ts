// Micropub endpoint: the one door for dropping a post. JSON (iA Writer),
// form-urlencoded, or multipart with photo files (an iOS Shortcut). Nothing is
// required but the content; the date, slug and kind are worked out here.

import type { APIRoute } from 'astro';
import {
  parseMicropubRequest,
  storedDateFor,
  buildPost,
  isAllowedImage,
  inboxPathFromUrl,
  MicropubError,
  type Photo,
  categoryList,
} from '../lib/micropub';
import { slugFor } from '../lib/slug';
import { listPostSlugs, commitFiles, GitHubError } from '../lib/github';
import { REPO, MAX_UPLOAD_BYTES, publishEnv, authorized, json } from '../lib/env';

export const prerender = false;

// Known thing slugs, from the files at build time (a new thing is a deploy anyway).
const THINGS = categoryList(Object.keys(import.meta.glob('/src/content/things/*.yaml')));

export const GET: APIRoute = async ({ request, locals }) => {
  const env = publishEnv(locals);
  if (!authorized(request, env.micropubToken)) {
    console.log(`[micropub] ${request.method} refused: ${request.headers.get('Authorization') ? 'wrong key' : 'no Authorization header'}`);
    return json({ error: 'unauthorized', error_description: 'Wrong or missing publishing key' }, 401);
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  if (q === 'config') {
    return json({
      'media-endpoint': `${url.origin}/micropub/media`,
      'post-types': [
        { type: 'note', name: 'Note' },
        { type: 'photo', name: 'Photo' },
        { type: 'article', name: 'Article' },
        { type: 'bookmark', name: 'Bookmark' },
      ],
    });
  }
  // The project tags, for a Shortcut's list or a client's tag suggestions (Micropub q=category).
  if (q === 'category') return json({ categories: THINGS });
  if (q === 'syndicate-to') return json({ 'syndicate-to': [] });
  return json({});
};

async function resolvePhotos(photos: Photo[]): Promise<Photo[]> {
  const out: Photo[] = [];
  for (const p of photos) {
    if (p.kind === 'file') {
      if (!isAllowedImage(p.type, p.name)) {
        throw new MicropubError(415, `Unsupported image ${p.name}: use JPEG, PNG, WebP or GIF (convert HEIC first)`);
      }
      if (p.data.byteLength > MAX_UPLOAD_BYTES) throw new MicropubError(413, `Image ${p.name} is over 10 MB`);
      out.push(p);
    } else if (p.kind === 'url') {
      const inbox = inboxPathFromUrl(p.url, REPO);
      if (inbox) {
        out.push({ kind: 'path', path: inbox });
        continue;
      }
      // Any other URL: fetch it once and commit it with the post.
      const res = await fetch(p.url);
      if (!res.ok) throw new MicropubError(400, `Could not fetch photo ${p.url}`);
      const type = res.headers.get('content-type')?.split(';')[0] ?? '';
      const name = new URL(p.url).pathname.split('/').pop() || 'photo';
      if (!isAllowedImage(type, name)) throw new MicropubError(415, `Unsupported image at ${p.url}`);
      const data = new Uint8Array(await res.arrayBuffer());
      if (data.byteLength > MAX_UPLOAD_BYTES) throw new MicropubError(413, `Image at ${p.url} is over 10 MB`);
      out.push({ kind: 'file', name, type, data });
    } else {
      out.push(p);
    }
  }
  return out;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = publishEnv(locals);
  if (!authorized(request, env.micropubToken)) {
    console.log(`[micropub] ${request.method} refused: ${request.headers.get('Authorization') ? 'wrong key' : 'no Authorization header'}`);
    return json({ error: 'unauthorized', error_description: 'Wrong or missing publishing key' }, 401);
  }
  if (!env.githubToken) return new Response('GitHub token not configured', { status: 500 });

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_UPLOAD_BYTES * 1.4) return new Response('Request too large', { status: 413 });

  try {
    const inc = await parseMicropubRequest(request);
    const photos = await resolvePhotos(inc.photos);
    if (!inc.content && !inc.name && !inc.link && photos.length === 0) {
      throw new MicropubError(400, 'Nothing to post');
    }

    const wanted = inc.categories.map((c) => c.trim().toLowerCase());
    const things = THINGS.filter((t) => wanted.includes(t));

    const gh = { token: env.githubToken, repo: REPO, branch: env.branch };
    const date = storedDateFor(inc, new Date(), env.requestZone);
    const slug = slugFor(date, await listPostSlugs(gh));
    const { files } = buildPost({ slug, date, name: inc.name, content: inc.content, things, link: inc.link, photos });
    await commitFiles(gh, files, `Post ${slug}`);

    const postUrl = `${new URL(request.url).origin}/${slug}`;
    return new Response(null, { status: 201, headers: { Location: postUrl } });
  } catch (e) {
    if (e instanceof MicropubError) return json({ error: 'invalid_request', error_description: e.message }, e.status);
    if (e instanceof GitHubError) return json({ error: 'server_error', error_description: e.message }, 502);
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: 'server_error', error_description: message }, 500);
  }
};
