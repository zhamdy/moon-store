/**
 * An S3-compatible object store driver.
 *
 * Written against the protocol, not a vendor: AWS S3, Cloudflare R2, DigitalOcean Spaces
 * and MinIO all speak this API, and which one you are on is an endpoint and a credential,
 * not a code path. Nothing above `StorageDriver` learns that any of this exists.
 *
 * ## The part that can destroy data
 *
 * `ownsUrl` and `keyFromUrl` answer two different questions, and the orphan sweep depends
 * on the difference:
 *
 *   - `keyFromUrl` → null means "no key came out of this URL".
 *   - `ownsUrl` → false means "this URL is not in my URL space at all".
 *
 * A URL that is *mine but unresolvable* — a legacy `/uploads/...` row still in the
 * database after `MEDIA_PUBLIC_BASE_URL` moved to a CDN — must answer `ownsUrl: true`,
 * `keyFromUrl: null`. That combination stops the sweep, because a routine that deletes
 * what nothing references must never read missing information as "unreferenced". A driver
 * that returned false/null for both would let the sweep classify every legacy image as an
 * orphan and delete the lot on its first run after a migration. #75 shipped exactly that
 * bug against the local driver; it is the reason `ownsUrl` exists at all, and the reason
 * `LEGACY_PUBLIC_PATH` is an owned prefix here even though this driver never writes it.
 */
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { assertSafeKey, type PutOptions, type StorageDriver, type StoredObject } from './types';
import { LEGACY_PUBLIC_PATH } from './localDriver';

export interface S3DriverOptions {
  readonly bucket: string;
  readonly region?: string;
  readonly endpoint?: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly forcePathStyle?: boolean;
  /** URL prefix `publicUrl` puts in front of a key — a CDN origin, or the bucket's own. */
  readonly baseUrl: string;
}

export class S3StorageDriver implements StorageDriver {
  readonly name = 's3';

  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor(options: S3DriverOptions) {
    this.bucket = options.bucket;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');

    const config: S3ClientConfig = {
      forcePathStyle: options.forcePathStyle ?? false,
    };
    if (options.region) config.region = options.region;
    if (options.endpoint) config.endpoint = options.endpoint;
    // Only pin credentials when both were supplied. Otherwise the SDK's default chain
    // applies, which is how an instance or container role is meant to be used.
    if (options.accessKeyId && options.secretAccessKey) {
      config.credentials = {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      };
    }
    this.client = new S3Client(config);
  }

  async put(key: string, body: Buffer, options: PutOptions): Promise<void> {
    const safe = assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safe,
        Body: body,
        ContentType: options.contentType,
      })
    );
  }

  /**
   * Idempotent, as the interface requires: S3 answers a delete of an absent key with a
   * success, so a retry after a partial failure is not an error the caller must handle.
   */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: assertSafeKey(key) })
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: assertSafeKey(key) })
      );
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      // Anything else — a permissions failure, a network fault — is not "absent", and
      // saying so would let the sweep treat an unreadable object as deletable.
      throw error;
    }
  }

  /**
   * Pages to the end deliberately. A truncated listing read as complete would make the
   * sweep believe objects beyond the first page do not exist.
   */
  async list(prefix: string): Promise<StoredObject[]> {
    const objects: StoredObject[] = [];
    let token: string | undefined;

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        })
      );
      for (const item of page.Contents ?? []) {
        if (!item.Key || item.Key.endsWith('/')) continue;
        objects.push({
          key: item.Key,
          size: item.Size ?? 0,
          lastModified: item.LastModified ?? new Date(0),
        });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    return objects;
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${assertSafeKey(key)}`;
  }

  /**
   * Every prefix a URL of this store can legitimately carry, longest first so a more
   * specific base wins over a shorter one that happens to be its prefix.
   *
   * `LEGACY_PUBLIC_PATH` is here even though this driver never produces it: rows written
   * before the migration to object storage still say `/uploads/...`, and they are this
   * store's objects under their old address. Leaving it out is precisely the mistake that
   * would make the sweep read them as somebody else's and delete them.
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

    prefixes.push(LEGACY_PUBLIC_PATH);

    return [...new Set(prefixes)].sort((a, b) => b.length - a.length);
  }

  /** The URL itself, plus its path when absolute — the forms worth comparing. */
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

  ownsUrl(url: string): boolean {
    return this.candidatePaths(url).some((candidate) =>
      this.ownedPrefixes().some((prefix) => candidate.startsWith(`${prefix}/`))
    );
  }

  keyFromUrl(url: string): string | null {
    for (const candidate of this.candidatePaths(url)) {
      for (const prefix of this.ownedPrefixes()) {
        const withSlash = `${prefix}/`;
        if (!candidate.startsWith(withSlash)) continue;

        const key = candidate.slice(withSlash.length);
        if (!key) continue;
        try {
          return assertSafeKey(key);
        } catch {
          // Ours, and unreadable. Null here with `ownsUrl` true is the signal that stops
          // the sweep; returning a guess would be worse than returning nothing.
          return null;
        }
      }
    }

    return null;
  }
}

/** S3 reports a missing key as 404/NotFound/NoSuchKey depending on the operation and store. */
function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
}
