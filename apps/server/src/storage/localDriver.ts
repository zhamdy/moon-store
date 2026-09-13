import fs from 'fs/promises';
import path from 'path';
import { assertSafeKey, type PutOptions, type StorageDriver, type StoredObject } from './types';

/**
 * The path every image written before `MEDIA_PUBLIC_BASE_URL` existed was stored under,
 * and the path `index.ts` mounts unconditionally. Owned forever: rows holding it are still
 * live references no matter where new URLs point.
 */
export const LEGACY_PUBLIC_PATH = '/uploads';

export interface LocalDriverOptions {
  /** Directory the objects live in. */
  root: string;
  /**
   * Prefix `publicUrl` puts in front of a key. Defaults to `/uploads`, which is exactly
   * the URL shape every existing `products.image_url` row already holds.
   */
  baseUrl?: string;
}

/**
 * Filesystem driver.
 *
 * The default in development and the compatibility default in production: with `root`
 * left alone it reads and writes the same `server/uploads` tree the old `multer.diskStorage`
 * used, and produces byte-identical URLs, so no existing row has to change.
 *
 * For a deployment it is only durable if `root` points at storage that outlives the
 * container and is shared by every instance — a mounted volume or network filesystem.
 * Where that is not available, the answer is a driver for the object store, not a change
 * here; everything above `StorageDriver` is already indifferent.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(options: LocalDriverOptions) {
    this.root = path.resolve(options.root);
    this.baseUrl = (options.baseUrl ?? '/uploads').replace(/\/+$/, '');
  }

  /** Absolute path for a key. Exposed for the static file mount, not for callers. */
  get rootDir(): string {
    return this.root;
  }

  private pathFor(key: string): string {
    return path.join(this.root, ...assertSafeKey(key).split('/'));
  }

  async put(key: string, body: Buffer, _options: PutOptions): Promise<void> {
    const target = this.pathFor(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.pathFor(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const normalized = prefix.replace(/\/+$/, '');
    const dir = normalized
      ? path.join(this.root, ...assertSafeKey(normalized).split('/'))
      : this.root;

    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }

    const objects: StoredObject[] = [];
    for (const entry of entries) {
      const stat = await fs.stat(path.join(dir, entry));
      if (!stat.isFile()) continue;
      objects.push({
        key: normalized ? `${normalized}/${entry}` : entry,
        size: stat.size,
        lastModified: stat.mtime,
      });
    }
    return objects;
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${assertSafeKey(key)}`;
  }

  /**
   * The URL forms this store answers for, longest first.
   *
   * More than one, because a store outlives its configuration. `MEDIA_PUBLIC_BASE_URL`
   * says where *new* URLs are minted; it does not retract the ones already in the
   * database, and the `/uploads` mount keeps serving them. A driver that only recognised
   * its current base would classify every legacy row as somebody else's — which is
   * exactly how a CDN cutover turned the orphan sweep into a delete-everything.
   */
  private ownedPrefixes(): string[] {
    const prefixes = [this.baseUrl];

    if (!this.baseUrl.startsWith('/')) {
      try {
        const basePath = new URL(this.baseUrl).pathname.replace(/\/+$/, '');
        if (basePath) prefixes.push(basePath);
      } catch {
        // Not a parseable absolute base; the raw prefix above is all there is.
      }
    }

    // The compatibility mount in `index.ts`, which is unconditional.
    prefixes.push(LEGACY_PUBLIC_PATH);

    return [...new Set(prefixes)].sort((a, b) => b.length - a.length);
  }

  /**
   * Whether the URL addresses this store's URL space at all — regardless of whether a
   * usable key comes out of it. `keyFromUrl` returning null is ambiguous between "not
   * ours" and "ours but unreadable", and a deletion routine must not conflate those.
   */
  ownsUrl(url: string): boolean {
    return this.candidatePaths(url).some((candidate) =>
      this.ownedPrefixes().some((prefix) => candidate.startsWith(`${prefix}/`))
    );
  }

  /**
   * The forms of a stored URL worth comparing: the URL itself, plus its path when it is
   * absolute. Path comparison is not a guess — an object of this store is reachable only
   * under an owned path, on whatever host the API is being served as.
   */
  private candidatePaths(url: string): string[] {
    if (!url) return [];
    const candidates = [url];
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      try {
        candidates.push(new URL(url).pathname);
      } catch {
        // Unparseable; the raw form is all there is to compare.
      }
    }
    return candidates;
  }

  keyFromUrl(url: string): string | null {
    const prefixes = this.ownedPrefixes();

    for (const candidate of this.candidatePaths(url)) {
      for (const prefix of prefixes) {
        const withSlash = `${prefix}/`;
        if (!candidate.startsWith(withSlash)) continue;

        const key = candidate.slice(withSlash.length);
        if (!key) continue;
        try {
          return assertSafeKey(key);
        } catch {
          return null;
        }
      }
    }

    return null;
  }
}
