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

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ 'media-endpoint': null }), {
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
  const content = props.content?.[0] || '';
  const isDraft = props['post-status']?.[0] === 'draft';
  const slug = slugify(title);
  const date = todayISO();

  // Build .mdoc file
  const frontmatter = [
    '---',
    `title: ${title}`,
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
    const err = await res.text();
    return new Response(`GitHub error: ${err}`, { status: 502 });
  }

  const postUrl = `https://by.erikov.me/${slug}`;
  return new Response('Created', {
    status: 201,
    headers: { Location: postUrl },
  });
};
