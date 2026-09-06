/**
 * Every operation's request contract, in one list (#102).
 *
 * This file only *collects*. Contracts are declared in the module that serves them, beside
 * the schemas, so a controller can parse through its own contract without importing
 * anything from `docs/` — the dependency runs modules → docs, never back.
 *
 * ## Coverage, and why "not listed" has to be impossible
 *
 * A served route that appears in neither list looks exactly like one that genuinely takes
 * no input: both produce a document with no request shape. `requestContractCoverage` is
 * the gate that refuses that, so an operation must be either a contract here or an
 * explicit entry in `unconvertedOperations` with a reason someone wrote down.
 *
 * Conversion is landing module by module. Until it finishes, `EXPECTED_UNCONVERTED` is the
 * ratchet: it is the count still to do, it may only fall, and the gate fails if it is left
 * above the true number — a ratchet above the real count has silently stopped ratcheting.
 */
import type { RequestContract, UnconvertedOperation } from '../http/requestContracts';
import { usersContractList } from '../modules/core/users/schemas';

export const requestContracts: readonly RequestContract[] = [...usersContractList];

/**
 * Operations that are accounted for without a Zod contract.
 *
 * `custom` needs a reason because it is a promise that the hand-written documentation was
 * checked against the parser by a person. `none` is a claim that the operation reads no
 * input at all, which the coverage test cannot verify on its own either.
 */
export const unconvertedOperations: readonly UnconvertedOperation[] = [];

/**
 * Served operations not yet classified. Lower it as modules convert; never raise it.
 * The exact number, not a ceiling: a gate that tolerates slack stops measuring.
 */
export const EXPECTED_UNCONVERTED = 196;
