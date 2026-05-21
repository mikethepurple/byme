import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'github',
    repo: 'mikethepurple/byme',
  },
  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      path: 'src/content/posts/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        date: fields.date({
          label: 'Date',
          validation: { isRequired: true },
        }),
        description: fields.text({
          label: 'Description',
          description: 'Short summary for post cards and meta tags',
          multiline: true,
        }),
        draft: fields.checkbox({
          label: 'Draft',
          description: 'Draft posts are not published',
          defaultValue: false,
        }),
        content: fields.markdoc({
          label: 'Content',
        }),
      },
    }),
  },
});
