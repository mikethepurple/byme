// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://by.erikov.me',
  adapter: cloudflare(),
  integrations: [react(), markdoc(), keystatic()],
});
