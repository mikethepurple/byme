import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

export async function GET(context: APIContext) {
  const allPosts = await getCollection('posts');

  const posts = allPosts
    .filter((p) => !p.data.draft)
    .sort((a, b) => {
      const dateA = new Date(a.data.date).getTime();
      const dateB = new Date(b.data.date).getTime();
      return dateB - dateA;
    });

  return rss({
    title: 'by.erikov.me',
    description: 'Misha Erikov — writing about building, making, and thinking out loud.',
    site: context.site ?? 'https://by.erikov.me',
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: new Date(post.data.date),
      description: post.data.description || '',
      link: `/${post.id}/`,
    })),
  });
}
