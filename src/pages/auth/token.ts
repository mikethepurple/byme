import type { APIRoute } from 'astro';

export const prerender = false;

// Token verification — client sends bearer token, we confirm it's valid
export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '');

  if (!token || token !== process.env.MICROPUB_TOKEN) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    me: 'https://by.erikov.me/',
    scope: 'create update delete',
    client_id: 'https://ia.net/',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Token issuance — exchange auth code for access token
export const POST: APIRoute = async ({ request }) => {
  const body = await request.formData();
  const grantType = body.get('grant_type');
  const code = body.get('code') as string;
  const redirectUri = body.get('redirect_uri') as string;
  const clientId = body.get('client_id') as string;

  if (!code) {
    return new Response(JSON.stringify({ error: 'invalid_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Decrypt the code to validate it
  try {
    const [ivB64, encB64] = code.split('.');
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const encrypted = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(process.env.KEYSTATIC_SECRET!.slice(0, 32)),
      'AES-GCM',
      false,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    const grant = JSON.parse(new TextDecoder().decode(decrypted));

    // Check code isn't older than 10 minutes
    if (Date.now() - grant.ts > 600_000) {
      return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Code expired' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      access_token: process.env.MICROPUB_TOKEN,
      token_type: 'Bearer',
      scope: grant.scope || 'create',
      me: grant.me || 'https://by.erikov.me/',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_grant' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
