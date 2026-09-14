/**
 * Slugs for products, categories and collections (plan 2026-09-14-002, KD-6).
 *
 * The column is nullable with a UNIQUE index (migration 014) and no CHECK, because pg-mem
 * has no regex support. So the pattern lives here, in the Zod schema every write path
 * parses through, and generation lives here too so the three resources cannot drift.
 *
 * Generation picks the first free candidate from one base -- `name_en`, else the SKU or
 * code, else `<resource>-<id>` -- trying `base`, `base-2` ... `base-10` in ONE statement.
 * A concurrent writer can still take the same candidate between that statement's snapshot
 * and its commit; the UNIQUE index referees, and the statement is re-run inside a
 * SAVEPOINT so the enclosing transaction survives the 23505 (a failed statement would
 * otherwise abort it). The retry is narrowed to the slug index by constraint name, which
 * pg-mem does not report, so that path is proven on real PostgreSQL only
 * (`tests/concurrency/catalogSlug.concurrency.test.ts`).
 *
 * Arabic names are never transliterated: a base is ASCII or it is skipped.
 *
 * No service, repository or pool import: `validators/` and `schemas.ts` import the Zod
 * schema from here, and generation must stay loadable without a database.
 */
import { z } from 'zod';
import { PublicError } from '../../../http/errors';
import { constraintName, isUniqueViolation } from '../../../database/constraintErrors';
import type { QueryResultRow } from 'pg';
import type { Queryable } from '../../../database/transaction';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 80;
/** Leaves room for the longest suffix, `-10`, well inside SLUG_MAX_LENGTH. */
export const SLUG_BASE_MAX_LENGTH = 70;
export const SLUG_CANDIDATE_COUNT = 10;
/** Attempts at the generating statement when a concurrent writer wins a candidate. */
const RACE_ATTEMPTS = 3;

/** `details[].code` for an explicit slug that another row already holds. */
export const SLUG_TAKEN_CODE = 'SLUG_TAKEN';
/** `details[].code` when every generated candidate is taken. */
export const SLUG_UNAVAILABLE_CODE = 'SLUG_UNAVAILABLE';

export const slugSchema = z
  .string()
  .min(1)
  .max(SLUG_MAX_LENGTH)
  .regex(SLUG_PATTERN, 'Slug must be lowercase letters and digits separated by single hyphens');

export type SlugTable = 'products' | 'categories' | 'collections';

/** The UNIQUE index names migration 014 creates; a 23505 on any other index is not ours. */
export const SLUG_CONSTRAINTS: Readonly<Record<SlugTable, string>> = {
  products: 'idx_products_slug',
  categories: 'idx_categories_slug',
  collections: 'idx_collections_slug',
};

const FALLBACK_PREFIX: Readonly<Record<SlugTable, string>> = {
  products: 'product',
  categories: 'category',
  collections: 'collection',
};

/**
 * Lowercase, every run of non-[a-z0-9] to one hyphen, trimmed, cut to 70 and trimmed
 * again -- the same rule as 014's backfill. `null` when nothing ASCII survives.
 */
export function slugify(value: string | null | undefined): string | null {
  if (!value) return null;
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_BASE_MAX_LENGTH)
    .replace(/-+$/g, '');
  return base === '' ? null : base;
}

/** `base`, `base-2` ... `base-10`. */
export function slugCandidates(base: string): string[] {
  return Array.from({ length: SLUG_CANDIDATE_COUNT }, (_, i) =>
    i === 0 ? base : `${base}-${i + 1}`
  );
}

/** The first source that slugifies to something, else `<resource>-<id>`. */
export function slugBase(
  table: SlugTable,
  id: number,
  sources: ReadonlyArray<string | null | undefined>
): string {
  for (const source of sources) {
    const base = slugify(source);
    if (base) return base;
  }
  return `${FALLBACK_PREFIX[table]}-${id}`;
}

/** A unique violation on this table's slug index, and nothing else. */
export function isSlugViolation(error: unknown, table: SlugTable): boolean {
  return isUniqueViolation(error) && constraintName(error) === SLUG_CONSTRAINTS[table];
}

export function slugTakenError(): PublicError {
  const message = 'Slug is already in use';
  return new PublicError('CONFLICT', message, [{ field: 'slug', code: SLUG_TAKEN_CODE, message }]);
}

function slugUnavailableError(base: string): PublicError {
  const message = `Every slug from "${base}" to "${base}-${SLUG_CANDIDATE_COUNT}" is taken; set a slug explicitly`;
  return new PublicError('CONFLICT', message, [
    { field: 'slug', code: SLUG_UNAVAILABLE_CODE, message },
  ]);
}

/** Rethrows a slug-index violation as the typed 409; anything else unchanged. */
export function rethrowSlugViolation(error: unknown, table: SlugTable): never {
  if (isSlugViolation(error, table)) throw slugTakenError();
  throw error;
}

/**
 * Refuses an explicit slug another row holds. An operator who typed it should be told,
 * not silently given `-2`.
 *
 * A read before the write is racy on its own; it exists so the refusal carries its field
 * detail on every engine. The UNIQUE index is the authority, and `rethrowSlugViolation`
 * around the write turns a lost race into the same 409 on real PostgreSQL.
 */
export async function assertSlugAvailable(
  queryable: Queryable,
  table: SlugTable,
  slug: string,
  exclude?: { column: 'id' | 'sku'; value: number | string }
): Promise<void> {
  const params: unknown[] = [slug];
  let sql = `SELECT 1 FROM ${table} WHERE slug = $1`;
  if (exclude) {
    params.push(exclude.value);
    sql += ` AND ${exclude.column} <> $2`;
  }
  const res = await queryable.query(`${sql} LIMIT 1`, params);
  if (res.rows.length > 0) throw slugTakenError();
}

/**
 * Gives row `id` the first free slug from its base, and returns the updated row.
 *
 * **`client` must be inside a transaction**: the retry uses a SAVEPOINT. Callers insert
 * the row and call this in the same transaction, so no committed row is ever visible
 * without its slug.
 *
 * The candidate choice is one `CASE WHEN NOT EXISTS ...` expression rather than a set
 * over `unnest` or `VALUES`: it is still a single statement, and pg-mem parses it.
 *
 * @throws PublicError CONFLICT (field `slug`) when all ten candidates are taken, or when a
 *   concurrent writer keeps winning past the retry budget.
 */
export async function assignGeneratedSlug<T extends QueryResultRow = Record<string, unknown>>(
  client: Queryable,
  table: SlugTable,
  id: number,
  sources: ReadonlyArray<string | null | undefined>
): Promise<T> {
  const base = slugBase(table, id, sources);
  const candidates = slugCandidates(base);
  const branches = candidates
    .map(
      (_, i) =>
        `WHEN NOT EXISTS (SELECT 1 FROM ${table} t WHERE t.slug = $${i + 2}::text) THEN $${i + 2}::text`
    )
    .join(' ');
  const sql = `UPDATE ${table} SET slug = CASE ${branches} ELSE NULL END WHERE id = $1 RETURNING *`;

  for (let attempt = 1; ; attempt += 1) {
    await client.query('SAVEPOINT slug_assign');
    let rows: T[];
    try {
      rows = (await client.query<T>(sql, [id, ...candidates])).rows;
      await client.query('RELEASE SAVEPOINT slug_assign');
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT slug_assign');
      if (!isSlugViolation(error, table)) throw error;
      if (attempt >= RACE_ATTEMPTS) throw slugUnavailableError(base);
      continue;
    }

    const row = rows[0];
    if (!row) throw new Error(`assignGeneratedSlug: ${table} row ${id} does not exist`);
    if (row.slug === null) throw slugUnavailableError(base);
    return row;
  }
}
