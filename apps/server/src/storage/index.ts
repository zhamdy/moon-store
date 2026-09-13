/**
 * Storage resolution.
 *
 * One driver per process, chosen by `MEDIA_STORAGE_DRIVER` through the validated env
 * config. `local` is the only driver shipped today and is the documented development
 * option; adding an object-store driver is a new file implementing `StorageDriver` plus a
 * case here — deliberately not a provider SDK wired through the controllers, and
 * deliberately no credentials anywhere in this repo.
 */
import path from 'path';
import { getEnv } from '../config/env';
import { LocalStorageDriver } from './localDriver';
import { S3StorageDriver } from './s3Driver';
import type { StorageDriver } from './types';

export * from './types';
export { LocalStorageDriver } from './localDriver';
export { S3StorageDriver } from './s3Driver';
export * from './keys';

/** Where the filesystem driver defaults to: `server/uploads`, as before. */
export const DEFAULT_LOCAL_ROOT = path.join(__dirname, '..', '..', 'uploads');

let instance: StorageDriver | null = null;

export function createStorageDriver(): StorageDriver {
  const env = getEnv();

  switch (env.MEDIA_STORAGE_DRIVER) {
    case 'local':
      return new LocalStorageDriver({
        root: env.MEDIA_LOCAL_ROOT || DEFAULT_LOCAL_ROOT,
        baseUrl: env.MEDIA_PUBLIC_BASE_URL,
      });
    case 's3': {
      /**
       * A missing bucket is a boot failure, loudly and by name. The alternative — falling
       * back to `local` the way the numeric env vars fall back to their defaults — would
       * start an instance that writes to a container filesystem while its operator
       * believes media is going to a bucket, and the loss would only surface at the next
       * redeploy. A misconfigured store is not a value to default; it is a stop.
       */
      if (!env.MEDIA_S3_BUCKET) {
        throw new Error(
          'MEDIA_STORAGE_DRIVER=s3 requires MEDIA_S3_BUCKET. Refusing to fall back to local storage: that would write media to the container filesystem and lose it on redeploy, silently.'
        );
      }
      /**
       * `publicUrl` needs somewhere to point. There is no safe default — the bucket's own
       * URL shape differs per provider and per path-style setting, and guessing wrong
       * writes unreachable URLs into the database.
       */
      if (!env.MEDIA_PUBLIC_BASE_URL) {
        throw new Error(
          'MEDIA_STORAGE_DRIVER=s3 requires MEDIA_PUBLIC_BASE_URL — the base every stored image_url is built from. There is no safe default: a wrong guess writes unreachable URLs into the database.'
        );
      }
      return new S3StorageDriver({
        bucket: env.MEDIA_S3_BUCKET,
        region: env.MEDIA_S3_REGION,
        endpoint: env.MEDIA_S3_ENDPOINT,
        accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID,
        secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY,
        forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE,
        baseUrl: env.MEDIA_PUBLIC_BASE_URL,
      });
    }
    default:
      // Unreachable while the enum is exhaustive; keeps the switch honest when it grows.
      throw new Error(`Unsupported MEDIA_STORAGE_DRIVER: ${String(env.MEDIA_STORAGE_DRIVER)}`);
  }
}

export function getStorage(): StorageDriver {
  if (!instance) {
    instance = createStorageDriver();
  }
  return instance;
}

/** Test seam, mirroring `setPool`. */
export function setStorage(driver: StorageDriver): void {
  instance = driver;
}

export function resetStorage(): void {
  instance = null;
}
