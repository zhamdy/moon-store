import fs from 'fs/promises';
import path from 'path';
import { assertSafeKey, type PutOptions, type StorageDriver, type StoredObject } from './types';

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

  keyFromUrl(url: string): string | null {
    if (!url) return null;

    let candidate = url;
    if (this.baseUrl.startsWith('/') && /^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      // A row may hold an absolute URL for an image this store still owns (an older
      // deployment that wrote `${CLIENT_URL}/uploads/...`). Compare on the path.
      try {
        candidate = new URL(url).pathname;
      } catch {
        return null;
      }
    }

    const prefix = `${this.baseUrl}/`;
    if (!candidate.startsWith(prefix)) return null;

    const key = candidate.slice(prefix.length);
    if (!key) return null;
    try {
      return assertSafeKey(key);
    } catch {
      return null;
    }
  }
}
