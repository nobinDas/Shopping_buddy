import 'server-only';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

/**
 * Encrypts OAuth tokens at rest with AES-256-GCM — see docs/SECURITY.md:
 * "Access and refresh tokens encrypted at rest with AES-256-GCM before
 * they touch the database. Never stored plaintext." Node's built-in
 * `crypto` module; no new dependency.
 *
 * Key comes from `TOKEN_ENCRYPTION_KEY`, read inside each function rather
 * than at module scope — same reason providers/supabase.ts does this for
 * its own env vars: narrowing an outer const doesn't survive into a
 * nested function body. Never logged, never committed (see
 * docs/SECURITY.md's logging rules) — this module never logs the key or
 * any plaintext token.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM's recommended IV length
const AUTH_TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env['TOKEN_ENCRYPTION_KEY'];
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set — generate one with `openssl rand -base64 32` and add it to .env.local.',
    );
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to exactly ${String(KEY_BYTES)} bytes (got ${String(key.length)}) — generate one with \`openssl rand -base64 32\`.`,
    );
  }

  return key;
}

/**
 * Encrypts a plaintext token. Output layout is `iv || authTag || ciphertext`
 * — self-contained, so decryptToken needs nothing but this buffer and the
 * key. A fresh random IV every call, per GCM's requirement that an IV is
 * never reused under the same key.
 */
export function encryptToken(plaintext: string): Buffer {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypts a buffer produced by encryptToken. Throws — rather than
 * returning corrupted data — if the buffer was tampered with or produced
 * under a different key; GCM's auth tag makes that a hard failure, which
 * is the point of using it over a non-authenticated mode.
 */
export function decryptToken(encrypted: Buffer): string {
  const key = getKey();

  if (encrypted.length < IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error('decryptToken: input is too short to contain an iv and auth tag.');
  }

  const iv = encrypted.subarray(0, IV_BYTES);
  const authTag = encrypted.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = encrypted.subarray(IV_BYTES + AUTH_TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
