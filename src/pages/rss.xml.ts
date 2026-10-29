import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadPosts, firstLine } from '../lib/load';
import { formatDate } from '../lib/posts';

export const prerender = true;

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET(context: APIContext) {
  const site = (context.site ?? new URL('https://by.erikov.me')).href.replace(/\/$/, '');
  const posts = await loadPosts();

  return rss({
    title: 'by.erikov.me',
    description: 'Misha Erikov. Things I make, dropped here as they happen.',
    site: context.site ?? 'https://by.erikov.me',
    items: posts.map((post) => {
      const title = post.data.title || firstLine(post.text) || `${post.kind} · ${formatDate(post.data.date)}`;
      const images = post.data.images
        .map((img) => `<p><img src="${site}${img.src}" alt="" /></p>`)
        .join('');
      const link = post.data.link ? `<p><a href="${post.data.link}">${escape(post.data.link)}</a></p>` : '';
      const text = post.text
        .split(/\n{2,}/)
        .map((para) => `<p>${escape(para.trim())}</p>`)
        .join('');
      return {
        title,
        pubDate: post.when,
        link: `/${post.id}/`,
        content: images + link + text,
        description: post.text ? firstLine(post.text, 160) : post.kind,
      };
    }),
  });
}
