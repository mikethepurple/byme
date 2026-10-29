import { defineMiddleware } from 'astro:middleware';

// One address: the root domain sends everything to by.erikov.me (Misha, 29.10.2026).
const CANONICAL_HOST = 'by.erikov.me';
const REDIRECT_HOSTS = new Set(['erikov.me', 'www.erikov.me']);

// Bridge the Cloudflare env into process.env for Keystatic (which reads it there).
// The publish endpoints read the env through `publishEnv()` and also see these.
export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 301);
  }

  const env = (context.locals as any).runtime?.env;
  if (env) {
    process.env.KEYSTATIC_GITHUB_CLIENT_ID ??= env.KEYSTATIC_GITHUB_CLIENT_ID;
    process.env.KEYSTATIC_GITHUB_CLIENT_SECRET ??= env.KEYSTATIC_GITHUB_CLIENT_SECRET;
    process.env.KEYSTATIC_SECRET ??= env.KEYSTATIC_SECRET;
    process.env.MICROPUB_TOKEN ??= env.MICROPUB_TOKEN;
    process.env.GITHUB_TOKEN ??= env.GITHUB_TOKEN;
    process.env.CONTENT_BRANCH ??= env.CONTENT_BRANCH;
  }
  return next();
});
