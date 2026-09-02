/**
 * Media storage abstraction.
 *
 * Uploaded product images used to be written straight to the API container's disk with
 * `multer.diskStorage`, which makes them local to whichever instance answered the upload:
 * a redeploy loses them, and a second instance serves 404s for images the first is happily
 * serving. The fix is not "use S3" — it is that nothing above this interface knows where
 * the bytes live. The controller puts a key and stores the URL the driver hands back; the
 * driver decides whether that is a file, a bucket object, or anything else.
 *
 * A key is a POSIX-style relative path inside the store, e.g. `products/1771875072587-4wjwqx.webp`.
 * It is never a filesystem path and never contains `..` — see `assertSafeKey`.
 */
export interface StoredObject {
  readonly key: string;
  readonly size: number;
  readonly lastModified: Date;
}

export interface PutOptions {
  readonly contentType: string;
}

export interface StorageDriver {
  /** Driver id, for logs and diagnostics. */
  readonly name: string;

  /** Writes (or overwrites) an object. */
  put(key: string, body: Buffer, options: PutOptions): Promise<void>;

  /**
   * Removes an object. Idempotent: deleting an absent key is a success, so a retry after
   * a partial failure cannot turn into an error the caller has to special-case.
   */
  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  /** Lists objects under a key prefix. Used by the orphan sweep. */
  list(prefix: string): Promise<StoredObject[]>;

  /** The URL a client should fetch this object from. */
  publicUrl(key: string): string;

  /**
   * Inverse of `publicUrl`: the key a stored URL refers to, or null when the URL does not
   * belong to this store. Returning null is what stops a delete from acting on a banner
   * that points at somebody else's CDN.
   */
  keyFromUrl(url: string): string | null;

  /**
   * Whether the URL addresses this store's URL space, whether or not a usable key comes
   * out of it.
   *
   * `keyFromUrl` returning null conflates two very different answers — "that is somebody
   * else's image" and "that is one of mine and I could not read it" — and a routine that
   * deletes what nothing references must not treat the second as the first. Callers that
   * delete ask this question too; callers that only resolve a URL do not need it.
   */
  ownsUrl(url: string): boolean;
}

/** Keys are ours to generate; this is a guard against a caller passing user input. */
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function assertSafeKey(key: string): string {
  if (!SAFE_KEY.test(key) || key.includes('..') || key.includes('//') || key.endsWith('/')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return key;
}
