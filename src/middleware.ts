import { defineMiddleware } from 'astro:middleware';

// Bridge the Cloudflare env into process.env for Keystatic (which reads it there).
// The publish endpoints read the env through `publishEnv()` and also see these.
export const onRequest = defineMiddleware(async (context, next) => {
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
