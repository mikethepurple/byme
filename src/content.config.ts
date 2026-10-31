import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

// A thing: a product, project or practice. A channel over the stream.
const things = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/things' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      line: z.string().default(''),
      order: z.number().default(99),
      try: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
      color: z.string().default(''), // the project's colour on paper, exact, e.g. #a8760e
      colorDark: z.string().default(''), // the brighter one for dark, e.g. #ffb424
      cover: image().optional(),
      screenshots: z.array(image()).default([]),
    }),
});

// A post: anything dropped in. Only the date is required.
// Image paths are root-relative (`/src/assets/posts/<slug>/1.jpg`), written by the
// publish endpoint; Vite resolves them against the project root.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      date: z.string(),
      title: z.string().optional(),
      things: z.array(reference('things')).default([]),
      images: z.array(image()).default([]),
      link: z.string().url().optional().or(z.literal('')),
      draft: z.boolean().default(false),
    }),
});

// About: one entry (about.yaml), edited in Keystatic as a singleton.
const about = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/about' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      bio: z.string().default(''),
      email: z.string().default(''),
      portrait: image().optional(),
      now: z.string().default(''),
      elsewhere: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
    }),
});

export const collections = { things, posts, about };
