import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encryptToken, decryptToken } from '@/server/providers/crypto';

const VALID_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' as const; // 32 zero bytes, base64
const OTHER_KEY = 'ZmluYWxseXNvbWVvdGhlcmtleWJ5dGVzMzJieXRlcw==' as const; // different 32 bytes

const originalKey = process.env['TOKEN_ENCRYPTION_KEY'];

beforeEach(() => {
  process.env['TOKEN_ENCRYPTION_KEY'] = VALID_KEY;
});

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env['TOKEN_ENCRYPTION_KEY'];
  } else {
    process.env['TOKEN_ENCRYPTION_KEY'] = originalKey;
  }
});

describe('encryptToken / decryptToken', () => {
  it('round-trips a plaintext token', () => {
    const plaintext = 'ya29.some-real-looking-refresh-token-value';
    const encrypted = encryptToken(plaintext);

    expect(Buffer.isBuffer(encrypted)).toBe(true);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it('never stores the plaintext verbatim in the output buffer', () => {
    const plaintext = 'a-very-distinctive-secret-marker';
    const encrypted = encryptToken(plaintext);

    expect(encrypted.toString('utf8')).not.toContain(plaintext);
    expect(encrypted.toString('base64')).not.toContain(plaintext);
  });

  it('produces a different ciphertext each call (random IV)', () => {
    const plaintext = 'same-token-twice';
    const first = encryptToken(plaintext);
    const second = encryptToken(plaintext);

    expect(first.equals(second)).toBe(false);
    // Both still decrypt to the same plaintext.
    expect(decryptToken(first)).toBe(plaintext);
    expect(decryptToken(second)).toBe(plaintext);
  });

  it('throws when the ciphertext is tampered with', () => {
    const encrypted = encryptToken('a-token');
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;

    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws when decrypting with a different key', () => {
    const encrypted = encryptToken('a-token');
    process.env['TOKEN_ENCRYPTION_KEY'] = OTHER_KEY;

    expect(() => decryptToken(encrypted)).toThrow();
  });

  it('throws on encrypt when the key env var is missing', () => {
    delete process.env['TOKEN_ENCRYPTION_KEY'];

    expect(() => encryptToken('a-token')).toThrow('TOKEN_ENCRYPTION_KEY is not set');
  });

  it('throws when the key is not exactly 32 bytes', () => {
    process.env['TOKEN_ENCRYPTION_KEY'] = Buffer.from('too-short').toString('base64');

    expect(() => encryptToken('a-token')).toThrow('must decode to exactly 32 bytes');
  });

  it('throws decrypting a buffer too short to hold an iv and auth tag', () => {
    expect(() => decryptToken(Buffer.from('short'))).toThrow('too short');
  });
});
