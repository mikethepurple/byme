import { config, fields, collection } from '@keystatic/core';

// Local mode in `astro dev` so posts can be opened and saved without GitHub;
// GitHub mode in production (the admin at /keystatic commits to the repo).
const storage =
  process.env.NODE_ENV === 'development'
    ? ({ kind: 'local' } as const)
    : ({ kind: 'github', repo: 'mikethepurple/byme' } as const);

export default config({
  storage,
  collections: {
    things: collection({
      label: 'Things',
      slugField: 'name',
      path: 'src/content/things/*',
      format: { data: 'yaml' },
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        line: fields.text({ label: 'One line' }),
        order: fields.integer({ label: 'Order in the grid', defaultValue: 99 }),
        try: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            url: fields.url({ label: 'URL' }),
          }),
          { label: 'Try links', itemLabel: (p) => p.fields.label.value },
        ),
        color: fields.text({ label: 'Colour', description: 'A hex colour like #ffb424; shown on the project name in cells and on its number in the navigation' }),
        cover: fields.image({
          label: 'Cover',
          directory: 'src/assets/things',
          publicPath: '/src/assets/things/',
        }),
        screenshots: fields.array(
          fields.image({
            label: 'Screenshot',
            directory: 'src/assets/things',
            publicPath: '/src/assets/things/',
          }),
          { label: 'Screenshots', itemLabel: (p) => p.value?.filename ?? '' },
        ),
      },
    }),
    posts: collection({
      label: 'Posts',
      slugField: 'slug',
      path: 'src/content/posts/*',
      format: { contentField: 'body' },
      schema: {
        slug: fields.text({
          label: 'Slug',
          description: 'Timestamp like 2026-10-29-1911; set by the publish endpoint',
        }),
        // A plain string: the wall clock where it was posted, with its offset
        // (2026-11-03T09:15:00+09:00). Keystatic's datetime field cannot hold an offset.
        date: fields.text({
          label: 'Date',
          description: 'As posted, with its offset, e.g. 2026-11-03T09:15:00+09:00',
          validation: { isRequired: true },
        }),
        title: fields.text({ label: 'Title (optional)' }),
        things: fields.array(
          fields.relationship({ label: 'Thing', collection: 'things' }),
          { label: 'Things', itemLabel: (p) => p.value ?? '' },
        ),
        // Image files are written by the publish endpoint under
        // src/assets/posts/<slug>/; this field only lists their paths.
        images: fields.array(fields.text({ label: 'Image path' }), {
          label: 'Images',
          itemLabel: (p) => p.value,
        }),
        link: fields.url({ label: 'Link (optional)' }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        pinned: fields.checkbox({ label: 'Show on the front page', defaultValue: false }),
        body: fields.markdoc({
          label: 'Text',
          options: {
            // Relative to the post file: the Markdoc integration only optimizes relative paths.
            image: { directory: 'src/assets/posts', publicPath: '../../assets/posts/' },
          },
        }),
      },
    }),
  },
});
