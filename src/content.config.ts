import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    description: z.string().optional().default(''),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { posts };
