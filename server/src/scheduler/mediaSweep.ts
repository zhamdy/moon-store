import type { Pool } from 'pg';
import logger from '../../lib/logger';
import { getEnv } from '../config/env';
import { getPool } from '../database/pool';
import { getStorage, PRODUCT_IMAGE_PREFIX, type StorageDriver } from '../storage';

/**
 * Every column that can reference a stored image.
 *
 * Deliberately one statement rather than three repository calls: the sweep deletes what
 * this query does not return, so a reference it cannot see is a deleted image. Keeping the
 * whole reference set visible in one place is what makes that reviewable.
 *
 * **Adding a table with an image URL means adding it here.**
 */
const REFERENCED_URLS_SQL = `
  SELECT image_url FROM products WHERE image_url IS NOT NULL
  UNION
  SELECT image_url FROM storefront_banners WHERE image_url IS NOT NULL
  UNION
  SELECT image_url FROM collections WHERE image_url IS NOT NULL
`;

export interface SweepOutcome {
  scanned: number;
  deleted: number;
  /** Unreferenced, but younger than the grace window — an upload in flight looks like this. */
  skippedRecent: number;
  failed: number;
}

export interface SweepOptions {
  pool?: Pool;
  storage?: StorageDriver;
  /** Overrides `MEDIA_ORPHAN_MIN_AGE_HOURS`. */
  minAgeMs?: number;
  now?: Date;
}

/**
 * Deletes stored product images that nothing references any more.
 *
 * The upload path already removes an image it replaces and the delete path removes the one
 * it drops, so this is the backstop for the cases those cannot cover: a crash between the
 * write and the row, a row deleted by a path that never saw the object, a restore from a
 * backup. It is the reason "does not leave permanent orphaned objects" holds even when a
 * best-effort delete fails.
 *
 * Two guards keep it from eating live media: it reads the reference set first and aborts
 * the whole sweep if that read fails, and it never touches an object younger than the grace
 * window, because an upload writes the object before the row that references it.
 */
export async function sweepOrphanedMedia(options: SweepOptions = {}): Promise<SweepOutcome> {
  const pool = options.pool ?? getPool();
  const storage = options.storage ?? getStorage();
  const minAgeMs = options.minAgeMs ?? getEnv().MEDIA_ORPHAN_MIN_AGE_HOURS * 60 * 60 * 1000;
  const cutoff = (options.now?.getTime() ?? Date.now()) - minAgeMs;

  // Throws on failure, which fails the job before anything is deleted. That is the point:
  // an empty reference set from a broken query would look exactly like "delete everything".
  const { rows } = await pool.query<{ image_url: string }>(REFERENCED_URLS_SQL);

  /**
   * A reference this store owns but cannot resolve to a key is missing information, not
   * an absent reference. Treating the two alike is what makes a sweep dangerous: under a
   * configuration change that stops a URL form resolving, every live image looks
   * unreferenced at once. So an unresolved reference aborts the whole sweep before
   * anything is deleted, and says which rows it could not read.
   *
   * A URL that does not address this store at all — a banner on somebody else's CDN — is
   * not missing information; it is a complete answer, and is skipped.
   */
  const referenced = new Set<string>();
  const unresolved: string[] = [];
  for (const row of rows) {
    const key = storage.keyFromUrl(row.image_url);
    if (key) {
      referenced.add(key);
    } else if (storage.ownsUrl(row.image_url)) {
      unresolved.push(row.image_url);
    }
  }

  if (unresolved.length > 0) {
    throw new Error(
      `Refusing to sweep: ${unresolved.length} referenced URL(s) address this store but ` +
        `could not be resolved to a key (e.g. ${unresolved.slice(0, 3).join(', ')})`
    );
  }

  const objects = await storage.list(PRODUCT_IMAGE_PREFIX);
  const outcome: SweepOutcome = {
    scanned: objects.length,
    deleted: 0,
    skippedRecent: 0,
    failed: 0,
  };

  for (const object of objects) {
    if (referenced.has(object.key)) continue;
    if (object.lastModified.getTime() > cutoff) {
      outcome.skippedRecent += 1;
      continue;
    }
    try {
      await storage.delete(object.key);
      outcome.deleted += 1;
    } catch (err) {
      outcome.failed += 1;
      logger.warn('Orphaned media could not be deleted', {
        key: object.key,
        error: (err as Error).message,
      });
    }
  }

  return outcome;
}
