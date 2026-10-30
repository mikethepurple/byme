// The sign-in code iA Writer trades for the publishing key: the grant,
// AES-GCM sealed with the Keystatic secret, written in URL-safe base64 so no
// client can mangle it ("+" read back as a space was the 400 on 30.10).

const enc = new TextEncoder();

async function key(secret: string, use: 'encrypt' | 'decrypt') {
  return crypto.subtle.importKey('raw', enc.encode(secret.slice(0, 32)), 'AES-GCM', false, [use]);
}

const toB64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function fromB64any(s: string): Uint8Array {
  let t = s.trim().replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
}

export async function sealGrant(grant: Record<string, unknown>, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret, 'encrypt'), enc.encode(JSON.stringify(grant))));
  return `${toB64url(iv)}.${toB64url(sealed)}`;
}

export async function openGrant(code: string, secret: string): Promise<Record<string, any>> {
  const [ivPart, sealedPart] = code.split('.');
  if (!ivPart || !sealedPart) throw new Error('malformed code');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64any(ivPart) }, await key(secret, 'decrypt'), fromB64any(sealedPart));
  return JSON.parse(new TextDecoder().decode(plain));
}
