// Runtime settings for the publish endpoints, from the Cloudflare env
// (bridged into process.env by the middleware) with local-dev fallbacks.

export const REPO = 'mikethepurple/byme';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface PublishEnv {
  micropubToken?: string;
  githubToken?: string;
  branch: string;
  requestZone?: string;
}

export function publishEnv(locals: App.Locals | Record<string, unknown>): PublishEnv {
  const runtime = (locals as { runtime?: { env?: Record<string, string>; cf?: { timezone?: string } } }).runtime;
  const env = runtime?.env ?? {};
  return {
    micropubToken: env.MICROPUB_TOKEN ?? process.env.MICROPUB_TOKEN,
    githubToken: env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
    branch: env.CONTENT_BRANCH ?? process.env.CONTENT_BRANCH ?? 'main',
    requestZone: runtime?.cf?.timezone,
  };
}

/** The publishing key is hex: anything else (spaces, invisible characters from a
 * rich-text note, a stray letter) is dropped before comparing. */
export const cleanKey = (s: string | null | undefined) => (s ?? '').replace(/[^0-9a-f]/gi, '').toLowerCase();

export function authorized(request: Request, token?: string): boolean {
  if (!token) return false;
  const auth = request.headers.get('Authorization') ?? '';
  const bearer = cleanKey(auth.replace(/^Bearer\s+/i, ''));
  return bearer.length > 0 && bearer === cleanKey(token);
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
