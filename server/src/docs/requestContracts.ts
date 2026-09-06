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
import { auditLogContractList } from '../modules/core/auditLog/schemas';
import { branchesContractList } from '../modules/core/branches/schemas';
import { settingsContractList } from '../modules/core/settings/schemas';
import { usersContractList } from '../modules/core/users/schemas';

export const requestContracts: readonly RequestContract[] = [
  // Core
  ...auditLogContractList,
  ...branchesContractList,
  ...settingsContractList,
  ...usersContractList,
];

/**
 * Operations that are accounted for without a Zod contract.
 *
 * `custom` needs a reason because it is a promise that the hand-written documentation was
 * checked against the parser by a person. `none` is a claim that the operation reads no
 * input at all, which the coverage test cannot verify on its own either.
 */
export const unconvertedOperations: readonly UnconvertedOperation[] = [
  /**
   * Auth is deliberately not a Zod contract.
   *
   * `login` checks `if (!email || !password)` and `refresh`/`logout` read the httpOnly
   * refresh cookie directly. Converting them would be a behaviour change on the
   * credential paths, not a documentation change: a Zod rejection is a 400
   * `VALIDATION_ERROR`, while these deliberately answer 401 for a missing or unusable
   * credential — a caller must not be able to tell a malformed attempt from a rejected
   * one. Tightening `email` to a string would also turn today's 401 for a non-string
   * into a 400, which is a rate-limiting and enumeration question rather than a typing
   * one. Worth doing; worth doing on purpose, with the auth tests in front of you.
   */
  {
    key: 'POST /api/v1/auth/login',
    classification: 'custom',
    reason:
      'Hand-rolled truthiness check on email/password. A Zod contract would turn a 401 ' +
      'into a 400 on the credential path; see the note above this list.',
  },
  {
    key: 'POST /api/v1/auth/refresh',
    classification: 'custom',
    reason:
      'Reads the httpOnly refreshToken cookie and answers 401 when it is absent or ' +
      'unusable. Documented by hand so the opaque-401 contract is not weakened.',
  },
  {
    key: 'POST /api/v1/auth/logout',
    classification: 'custom',
    reason:
      'Reads the httpOnly refreshToken cookie and tolerates its absence, so an already ' +
      'logged-out caller still gets a 204.',
  },
  {
    key: 'POST /api/v1/auth/logout-all',
    classification: 'none',
    reason: 'Identified by the access token alone; reads no body, query or path input.',
  },
  {
    key: 'GET /api/v1/auth/me',
    classification: 'none',
    reason: 'Returns the bearer token holder; reads no body, query or path input.',
  },
  {
    key: 'GET /api/health',
    classification: 'none',
    reason: 'Liveness probe, mounted on the app rather than the router. No input.',
  },
  {
    key: 'GET /api/health/live',
    classification: 'none',
    reason: 'Liveness probe. No input.',
  },
  {
    key: 'GET /api/health/ready',
    classification: 'none',
    reason: 'Readiness probe. No input.',
  },
];

/**
 * Served operations not yet classified. Lower it as modules convert; never raise it.
 * The exact number, not a ceiling: a gate that tolerates slack stops measuring.
 */
export const EXPECTED_UNCONVERTED = 176;
