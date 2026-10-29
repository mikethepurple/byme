// Micropub media endpoint: a client uploads one `file`, gets a URL back, and
// then references it in its post. The file lands in the repo's inbox folder on
// the content branch; the post endpoint maps the URL back to that path.

import type { APIRoute } from 'astro';
import { isAllowedImage, MicropubError } from '../../lib/micropub';
import { commitFiles, GitHubError } from '../../lib/github';
import { REPO, MAX_UPLOAD_BYTES, publishEnv, authorized, json } from '../../lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = publishEnv(locals);
  if (!authorized(request, env.micropubToken)) return new Response('Unauthorized', { status: 401 });
  if (!env.githubToken) return new Response('GitHub token not configured', { status: 500 });

  try {
    let fd: FormData;
    try {
      fd = await request.formData();
    } catch {
      throw new MicropubError(400, 'Expected multipart/form-data with a "file" part');
    }
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) throw new MicropubError(400, 'No file');
    if (!isAllowedImage(file.type, file.name)) {
      throw new MicropubError(415, `Unsupported image ${file.name}: use JPEG, PNG, WebP or GIF (convert HEIC first)`);
    }
    if (file.size > MAX_UPLOAD_BYTES) throw new MicropubError(413, 'Image is over 10 MB');

    const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '') || 'image';
    const path = `src/assets/inbox/${Math.floor(Date.now() / 1000)}-${safe}`;
    const data = new Uint8Array(await file.arrayBuffer());
    await commitFiles({ token: env.githubToken, repo: REPO, branch: env.branch }, [{ path, content: data }], `Upload ${path}`);

    const url = `https://raw.githubusercontent.com/${REPO}/${env.branch}/${path}`;
    return new Response(null, { status: 201, headers: { Location: url } });
  } catch (e) {
    if (e instanceof MicropubError) return json({ error: 'invalid_request', error_description: e.message }, e.status);
    if (e instanceof GitHubError) return json({ error: 'server_error', error_description: e.message }, 502);
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: 'server_error', error_description: message }, 500);
  }
};
