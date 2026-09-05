/**
 * Recognising a database constraint failure by its code rather than its prose.
 *
 * PostgreSQL reports these as SQLSTATE values, which node-postgres surfaces as `err.code`.
 * Before this, a dozen controllers asked `err.message?.includes('UNIQUE')` — a test on
 * wording that is not part of any contract. It depends on the server's `lc_messages`, on
 * the driver, and on nobody rephrasing anything; and it matches too much, because a
 * validation message that happens to contain the word "unique" reads as a duplicate-key
 * failure and is answered with a 409.
 *
 * `'UNIQUE'` also came from the SQLite era — PostgreSQL's own text is
 * `duplicate key value violates unique constraint "..."`, lowercase — so half of every
 * one of those checks had been dead since the migration without anyone noticing, which is
 * exactly what makes string-matching an error a bad way to know what happened.
 *
 * SQLSTATE values are defined by the standard and stable across versions and locales.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';
export const NOT_NULL_VIOLATION = '23502';
export const CHECK_VIOLATION = '23514';

function sqlState(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** A row collided with a unique index — a duplicate SKU, barcode, email, code. */
export function isUniqueViolation(error: unknown): boolean {
  return sqlState(error) === UNIQUE_VIOLATION;
}

/** A referenced row does not exist, or a referencing row still does. */
export function isForeignKeyViolation(error: unknown): boolean {
  return sqlState(error) === FOREIGN_KEY_VIOLATION;
}

/** A CHECK constraint refused the value — a negative quantity, an unknown status. */
export function isCheckViolation(error: unknown): boolean {
  return sqlState(error) === CHECK_VIOLATION;
}

/**
 * The constraint's name, when the database named one.
 *
 * Useful for telling *which* uniqueness failed when a table has several — `products_sku_key`
 * versus `products_barcode_key` — without going back to the message text this module exists
 * to stop reading.
 */
export function constraintName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const name = (error as { constraint?: unknown }).constraint;
  return typeof name === 'string' ? name : undefined;
}
