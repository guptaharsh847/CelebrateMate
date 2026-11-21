import { describe, expect, it } from 'vitest';
import { decodeJwtPayload } from './session';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.signature`;
}

describe('decodeJwtPayload', () => {
  it('decodes base64url payloads including UTF-8 names', () => {
    const token = fakeJwt({ email: 'owner@example.com', name: 'Zoë Śharma', exp: 1893456000 });
    expect(decodeJwtPayload(token)).toEqual({ email: 'owner@example.com', name: 'Zoë Śharma', exp: 1893456000 });
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwtPayload('nope')).toBeNull();
    expect(decodeJwtPayload('a.%%%.c')).toBeNull();
  });
});
