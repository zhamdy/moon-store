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
import type { StorageDriver } from './types';

export * from './types';
export { LocalStorageDriver } from './localDriver';
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
    default:
      // Unreachable while the enum has one member; keeps the switch honest when it grows.
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
