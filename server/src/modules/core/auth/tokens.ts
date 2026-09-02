import { createHash } from 'crypto';

/**
 * One-way digest of a refresh token, for storage and lookup.
 *
 * SHA-256 rather than bcrypt, deliberately. bcrypt's cost factor exists to make a
 * dictionary or brute-force attack on a *low-entropy human-chosen* secret expensive. A
 * refresh token here is a signed JWT carrying a random UUID `jti` -- there is no
 * dictionary, and no attacker is going to brute-force a preimage of that entropy no
 * matter how cheap the hash is. What bcrypt would cost is real: ~100ms of CPU on every
 * refresh, and, because bcrypt is salted, no way to look a token up by digest at all
 * (every stored row would have to be compared one by one, turning an index probe into a
 * full table scan of a table that grows with every session).
 *
 * The property that actually matters is preimage resistance against someone holding the
 * stored digests, and SHA-256 has it. Hex rather than base64 so the column is trivially
 * greppable and index-friendly, and constant-width at 64 characters.
 */
export function digestRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
