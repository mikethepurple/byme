import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const env = (context.locals as any).runtime?.env;
  if (env) {
    process.env.KEYSTATIC_GITHUB_CLIENT_ID ??= env.KEYSTATIC_GITHUB_CLIENT_ID;
    process.env.KEYSTATIC_GITHUB_CLIENT_SECRET ??= env.KEYSTATIC_GITHUB_CLIENT_SECRET;
    process.env.KEYSTATIC_SECRET ??= env.KEYSTATIC_SECRET;
    process.env.MICROPUB_TOKEN ??= env.MICROPUB_TOKEN;
    process.env.GITHUB_TOKEN ??= env.GITHUB_TOKEN;
  }
  return next();
});
