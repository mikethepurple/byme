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

  // Log micropub/auth requests to D1 for debugging
  const url = new URL(context.request.url);
  if (url.pathname.includes('micropub') || url.pathname.includes('auth')) {
    const db = env?.DB;
    if (db) {
      try {
        await db.prepare(
          'CREATE TABLE IF NOT EXISTS request_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, method TEXT, url TEXT, headers TEXT, body TEXT)'
        ).run();
        let body = '';
        try { body = await context.request.clone().text(); } catch {}
        const headers = Object.fromEntries(context.request.headers.entries());
        // Redact token values
        if (headers.authorization) headers.authorization = headers.authorization.substring(0, 15) + '...';
        await db.prepare(
          'INSERT INTO request_log (ts, method, url, headers, body) VALUES (?, ?, ?, ?, ?)'
        ).bind(new Date().toISOString(), context.request.method, context.request.url, JSON.stringify(headers), body.substring(0, 1000)).run();
      } catch {}
    }
  }

  return next();
});
