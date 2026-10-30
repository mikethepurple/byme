import { describe, it, expect } from 'vitest';
import { sealGrant, openGrant } from './grant';

const secret = 'x'.repeat(40);

describe('sign-in codes survive any client encoding', () => {
  it('round-trips and uses only URL-safe characters', async () => {
    for (let i = 0; i < 20; i++) {
      const code = await sealGrant({ scope: 'create', me: 'https://by.erikov.me/', ts: Date.now() }, secret);
      expect(code).toMatch(/^[A-Za-z0-9_.-]+$/);
      expect((await openGrant(code, secret)).scope).toBe('create');
    }
  });
  it('reads an old-style base64 code even if a client turned + into spaces', async () => {
    const code = await sealGrant({ scope: 'create', ts: Date.now() }, secret);
    const old = code.replace(/-/g, '+').replace(/_/g, '/');
    expect((await openGrant(old.replace(/\+/g, ' '), secret)).scope).toBe('create');
  });
  it('rejects a wrong secret', async () => {
    const code = await sealGrant({ scope: 'create', ts: Date.now() }, secret);
    await expect(openGrant(code, 'y'.repeat(40))).rejects.toThrow();
  });
});
