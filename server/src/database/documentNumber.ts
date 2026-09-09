/**
 * Allocating a human-facing document number that a UNIQUE index will accept.
 *
 * Delivery orders, purchase orders, layaway plans and online orders all name themselves
 * `PREFIX-YYYYMMDD-NNNN` with a random suffix, and every one of those columns carries a
 * UNIQUE index. Nothing checked whether the number was free, so a same-day collision
 * surfaced as an unmapped SQLSTATE 23505 and the caller got a 500 for a create that was
 * perfectly valid (#128). Delivery was an order of magnitude worse than the rest: a
 * 3-digit suffix collides on the ~30th delivery of a day with probability around 35%.
 *
 * The fix is to insert and let the database referee, rather than to look before leaping:
 * a check-then-insert loop (what `GiftCardsService.create` does) is TOCTOU-racy, because
 * two callers can both find a number free and then both insert it. Here the unique index
 * is the only authority, a violation on *that* index means "taken", and the work is
 * retried with a fresh number.
 *
 * **Each attempt must be its own transaction.** In PostgreSQL a failed statement aborts
 * the surrounding transaction, so retrying inside one would run every later statement
 * against a dead transaction. `run` is therefore expected to open its own transaction
 * (or be a single statement), and is called again from the top on each attempt.
 */
import { PublicError } from '../http/errors';
import { constraintName, isUniqueViolation } from './constraintErrors';
import logger from '../../lib/logger';

export interface DocumentNumberOptions {
  /** Mints a candidate. Called once per attempt, so each retry gets a fresh number. */
  generate: () => string;
  /**
   * The UNIQUE constraint that means "this number is taken".
   *
   * Load-bearing, not decoration: an insert can violate more than one unique index, and
   * a retry loop that re-rolled the number on *any* 23505 would spin uselessly against,
   * say, a duplicate email before failing with a message about document numbers.
   */
  constraint: string;
  /** What is being numbered, for the error a caller sees. */
  label: string;
  /** Attempts in total, including the first. */
  maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Runs `run` with a freshly generated document number, retrying with a new one while the
 * named unique constraint rejects it.
 *
 * @throws PublicError('CONFLICT') once the attempts are exhausted — a typed refusal the
 *   caller can act on, never the 500 an unmapped 23505 produced.
 */
export async function withDocumentNumber<T>(
  options: DocumentNumberOptions,
  run: (documentNumber: string) => Promise<T>
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 1; ; attempt += 1) {
    const documentNumber = options.generate();

    try {
      return await run(documentNumber);
    } catch (error) {
      const collided = isUniqueViolation(error) && constraintName(error) === options.constraint;

      if (!collided || attempt >= maxAttempts) {
        if (collided) {
          logger.warn('Exhausted document number attempts', {
            label: options.label,
            attempts: maxAttempts,
          });
          throw new PublicError(
            'CONFLICT',
            `Could not allocate a unique ${options.label} number; please retry`
          );
        }
        throw error;
      }

      logger.warn('Document number collision, retrying with a new one', {
        label: options.label,
        attempt,
      });
    }
  }
}
