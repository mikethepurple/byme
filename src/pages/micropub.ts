import type { APIRoute } from 'astro';

export const prerender = false;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export const GET: APIRoute = async ({ request }) => {
  // Verify token on GET requests too
  const auth = request.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '');
  if (!token || token !== process.env.MICROPUB_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q');

  if (q === 'config') {
    return new Response(JSON.stringify({
      'post-types': [{ type: 'note', name: 'Note' }, { type: 'article', name: 'Article' }],
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (q === 'syndicate-to') {
    return new Response(JSON.stringify({ 'syndicate-to': [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({}), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  // Auth
  const auth = request.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '');
  if (!token || token !== process.env.MICROPUB_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();

  // Only handle h-entry creation
  if (!body.type?.includes('h-entry')) {
    return new Response('Unsupported type', { status: 400 });
  }

  const props = body.properties || {};
  const title = props.name?.[0] || 'Untitled';
  const rawContent = props.content?.[0] || '';
  // iA Writer sends content as {html: "..."} or plain string
  let content = typeof rawContent === 'object' && rawContent.html
    ? rawContent.html
    : String(rawContent);
  // Strip leading heading — it becomes the frontmatter title
  content = content.replace(/^\s*#+ .+\n*/, '');
  const isDraft = false;
  const baseSlug = slugify(title);
  const slug = baseSlug || `post-${Date.now()}`;
  const date = todayISO();

  // Build .mdoc file
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `date: '${date}'`,
    `description: ''`,
    `draft: ${isDraft}`,
    '---',
  ].join('\n');
  const fileContent = `${frontmatter}\n\n${content}\n`;

  // Commit to GitHub via API
  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) {
    return new Response('GitHub token not configured', { status: 500 });
  }

  const path = `src/content/posts/${slug}.mdoc`;
  const res = await fetch(
    `https://api.github.com/repos/mikethepurple/byme/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'by.erikov.me-micropub',
      },
      body: JSON.stringify({
        message: `Add post: ${title}`,
        content: btoa(unescape(encodeURIComponent(fileContent))),
        branch: 'main',
      }),
    }
  );

  if (!res.ok) {
    // File might already exist — try with timestamp suffix
    const retryPath = `src/content/posts/${slug}-${Date.now()}.mdoc`;
    const retryRes = await fetch(
      `https://api.github.com/repos/mikethepurple/byme/contents/${retryPath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'by.erikov.me-micropub',
        },
        body: JSON.stringify({
          message: `Add post: ${title}`,
          content: btoa(unescape(encodeURIComponent(fileContent))),
          branch: 'main',
        }),
      }
    );
    if (!retryRes.ok) {
      const err = await retryRes.text();
      return new Response(JSON.stringify({ error: err }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const postUrl = `https://by.erikov.me/${slug}`;
  return new Response(JSON.stringify({ url: postUrl }), {
    status: 201,
    headers: {
      Location: postUrl,
      'Content-Type': 'application/json',
    },
  });
};
