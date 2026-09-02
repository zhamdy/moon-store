import { createHash, createHmac } from 'crypto';

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

/**
 * The `jti` of the successor a given refresh token rotates into.
 *
 * Deterministic, and that is the whole point. Two callers presenting the same token --
 * two browser tabs sharing one cookie jar, or a till retrying after a dropped response --
 * must converge on the *same* successor. If each minted a fresh one, the second caller
 * would invalidate the token the first was already handed, and the next request carrying
 * that now-dead token would be classified as reuse and revoke the whole family: precisely
 * the spurious logout the grace window exists to prevent.
 *
 * Keyed with the refresh secret, so possession of a refresh token does not let anyone
 * predict its successor. An attacker who has the token can obtain the successor by
 * presenting it anyway, so the HMAC gives away nothing it did not already have; what it
 * prevents is deriving successors for tokens the attacker has never seen.
 */
export function deriveSuccessorJti(refreshSecret: string, presentedDigest: string): string {
  return createHmac('sha256', refreshSecret)
    .update(`refresh-rotation:${presentedDigest}`)
    .digest('hex');
}
