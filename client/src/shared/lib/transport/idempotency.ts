/**
 * The `Idempotency-Key` contract, kept beside the transport that sends it.
 *
 * The server accepts a non-empty, printable-ASCII key of at most 255
 * characters and answers anything else with a 400, so both the generator and
 * the in-memory fake read the rule from here rather than restating it.
 */

const MAX_KEY_LENGTH = 255;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

export function isValidIdempotencyKey(key: string): boolean {
  return key.length > 0 && key.length <= MAX_KEY_LENGTH && PRINTABLE_ASCII.test(key);
}

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * `crypto.randomUUID` exists only in a secure context, and a till served over
 * plain HTTP on a shop LAN is exactly the deployment this key has to survive.
 * The fallback is not a UUID and does not need to be — the server treats the
 * key as an opaque printable-ASCII string, and uniqueness is all that matters.
 */
export function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${randomHex(16)}`;
}
