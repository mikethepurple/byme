import type { APIRoute } from 'astro';
import { openGrant } from '../../lib/grant';

export const prerender = false;

// Token verification — a client checks a key it already has: as a Bearer
// header (IndieAuth), or as `token` in the query or a form body (RFC 7662
// introspection). Case-insensitive "Bearer", whitespace trimmed, refusals logged.
function keyFrom(request: Request, body?: Record<string, string>): string {
  const h = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return h || new URL(request.url).searchParams.get('token')?.trim() || body?.token?.trim() || '';
}
function verified(key: string): Response {
  const ok = !!key && key === (process.env.MICROPUB_TOKEN ?? '').trim();
  if (!ok) console.log(`[auth/token] verify refused: ${key ? `key of length ${key.length}` : 'no key'}`);
  return new Response(
    JSON.stringify(
      ok
        ? { active: true, me: 'https://by.erikov.me/', scope: 'create update delete media', client_id: 'https://ia.net/' }
        : { active: false, error: 'unauthorized' },
    ),
    { status: ok ? 200 : 401, headers: { 'Content-Type': 'application/json' } },
  );
}
export const GET: APIRoute = async ({ request }) => verified(keyFrom(request));

// Token issuance — exchange the sign-in code for the publishing key. Accepts a
// form or JSON body; logs why a request is refused (visible in the Pages logs).
async function readBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await request.json()) as Record<string, string>;
  const fd = await request.formData();
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
}
const fail = (error: string, why: string, status = 400) => {
  console.log(`[auth/token] ${status} ${error}: ${why}`);
  return new Response(JSON.stringify({ error, error_description: why }), { status, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, string>;
  try {
    body = await readBody(request);
  } catch {
    return fail('invalid_request', 'unreadable body');
  }
  if (!body.code && (body.token || body.action === 'verify' || request.headers.get('Authorization'))) return verified(keyFrom(request, body));
  if (!body.code) return fail('invalid_request', `no code (fields: ${Object.keys(body).join(',')})`);
  let grant: Record<string, any>;
  try {
    grant = await openGrant(body.code, process.env.KEYSTATIC_SECRET ?? '');
  } catch {
    return fail('invalid_grant', 'code does not open');
  }
  if (Date.now() - grant.ts > 600_000) return fail('invalid_grant', 'code expired');
  return new Response(
    JSON.stringify({
      access_token: process.env.MICROPUB_TOKEN,
      token_type: 'Bearer',
      scope: grant.scope || 'create',
      me: grant.me || 'https://by.erikov.me/',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
