/**
 * Media storage: the driver contract, the upload gate, and the image lifecycle.
 *
 * The controller tests run against an in-memory driver rather than a temp directory. What
 * they are asserting is the *ordering* the lifecycle depends on — validate, write, commit,
 * then release the old object — and the ordering is what has to hold on a driver that is a
 * remote bucket, not a disk.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { LocalStorageDriver } from '../src/storage/localDriver';
import {
  assertSafeKey,
  type PutOptions,
  type StorageDriver,
  type StoredObject,
} from '../src/storage/types';
import {
  productImageKey,
  extensionForContentType,
  PRODUCT_IMAGE_PREFIX,
} from '../src/storage/keys';
import { detectImageType, validateImageBytes, createImageUpload } from '../src/storage/upload';
import { setStorage, resetStorage, createStorageDriver } from '../src/storage';
import { S3StorageDriver } from '../src/storage/s3Driver';
import { S3Client } from '@aws-sdk/client-s3';
import { resetEnvCache } from '../src/config/env';
import { ProductsController } from '../src/modules/inventory/products/controller';
import { productsRepository } from '../src/modules/inventory/products/repository';
import productsRouter from '../src/modules/inventory/products/routes';
import { sweepOrphanedMedia } from '../src/scheduler/mediaSweep';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(20)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(8),
]);

/** In-memory driver, so a controller test asserts behaviour rather than filesystem state. */
class FakeDriver implements StorageDriver {
  readonly name = 'fake';
  readonly objects = new Map<string, { body: Buffer; contentType: string; lastModified: Date }>();
  failPutKeys = new Set<string>();
  failDeleteKeys = new Set<string>();

  async put(key: string, body: Buffer, options: PutOptions): Promise<void> {
    if (this.failPutKeys.has(key)) throw new Error('put failed');
    this.objects.set(assertSafeKey(key), {
      body,
      contentType: options.contentType,
      lastModified: new Date(),
    });
  }

  async delete(key: string): Promise<void> {
    if (this.failDeleteKeys.has(key)) throw new Error('delete failed');
    this.objects.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async list(prefix: string): Promise<StoredObject[]> {
    return [...this.objects.entries()]
      .filter(([key]) => key.startsWith(`${prefix}/`))
      .map(([key, value]) => ({ key, size: value.body.length, lastModified: value.lastModified }));
  }

  publicUrl(key: string): string {
    return `/uploads/${key}`;
  }

  /** URLs in this store's space that deliberately fail to resolve to a key. */
  unreadableUrls = new Set<string>();

  keyFromUrl(url: string): string | null {
    if (this.unreadableUrls.has(url)) return null;
    return url.startsWith('/uploads/') ? url.slice('/uploads/'.length) : null;
  }

  ownsUrl(url: string): boolean {
    return url.startsWith('/uploads/');
  }
}

function response() {
  const res: Partial<Response> & { body?: unknown; statusCode?: number } = {};
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as never;
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res as Response;
  }) as never;
  res.send = vi.fn(() => res as Response) as never;
  return res as Response & { body?: unknown; statusCode?: number };
}

describe('LocalStorageDriver', () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'moon-storage-'));
    driver = new LocalStorageDriver({ root });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('round-trips an object and lists it under its prefix', async () => {
    await driver.put('products/a.png', PNG, { contentType: 'image/png' });

    expect(await driver.exists('products/a.png')).toBe(true);
    const listed = await driver.list('products');
    expect(listed.map((o) => o.key)).toEqual(['products/a.png']);
    expect(listed[0].size).toBe(PNG.length);
    expect(await fs.readFile(path.join(root, 'products', 'a.png'))).toEqual(PNG);
  });

  it('produces exactly the URL shape already stored in the database', () => {
    expect(driver.publicUrl('products/1771875072587-4wjwqx.webp')).toBe(
      '/uploads/products/1771875072587-4wjwqx.webp'
    );
    expect(driver.keyFromUrl('/uploads/products/1771875072587-4wjwqx.webp')).toBe(
      'products/1771875072587-4wjwqx.webp'
    );
  });

  it('recognises an absolute URL that points at its own base path', () => {
    expect(driver.keyFromUrl('https://shop.example.com/uploads/products/a.png')).toBe(
      'products/a.png'
    );
  });

  it('returns null for a URL it does not own, so a foreign image is never deleted', () => {
    for (const url of [
      'https://cdn.example.com/banners/hero.jpg',
      '/static/products/a.png',
      '',
      'uploads/products/a.png',
    ]) {
      expect(driver.keyFromUrl(url)).toBeNull();
      expect(driver.ownsUrl(url)).toBe(false);
    }
  });

  it('serves a configured base URL while still resolving its own keys', () => {
    const cdn = new LocalStorageDriver({ root, baseUrl: 'https://cdn.example.com/media' });
    expect(cdn.publicUrl('products/a.png')).toBe('https://cdn.example.com/media/products/a.png');
    expect(cdn.keyFromUrl('https://cdn.example.com/media/products/a.png')).toBe('products/a.png');
  });

  it('still owns its legacy URLs after the base moves to a CDN', () => {
    // The documented migration sets an absolute base while rows written before it stay
    // relative and keep being served by the /uploads mount. A driver that disowned them
    // would report every one of them as unreferenced.
    const cdn = new LocalStorageDriver({ root, baseUrl: 'https://cdn.example.com/media' });

    expect(cdn.keyFromUrl('/uploads/products/legacy.png')).toBe('products/legacy.png');
    expect(cdn.ownsUrl('/uploads/products/legacy.png')).toBe(true);
    // The base's own path is owned in relative form too, for a same-origin CDN.
    expect(cdn.keyFromUrl('/media/products/a.png')).toBe('products/a.png');
    // Someone else's image is still someone else's.
    expect(cdn.keyFromUrl('https://other.example.com/hero.png')).toBeNull();
    expect(cdn.ownsUrl('https://other.example.com/hero.png')).toBe(false);
  });

  it('separates "not mine" from "mine but unreadable"', () => {
    // A key that cannot be parsed is missing information, not an absent reference — the
    // sweep has to be able to tell the two apart.
    expect(driver.keyFromUrl('/uploads/products/../../etc/passwd')).toBeNull();
    expect(driver.ownsUrl('/uploads/products/../../etc/passwd')).toBe(true);
  });

  it('deleting an absent object succeeds, so a retry is not an error', async () => {
    await driver.put('products/a.png', PNG, { contentType: 'image/png' });
    await driver.delete('products/a.png');
    await expect(driver.delete('products/a.png')).resolves.toBeUndefined();
    expect(await driver.exists('products/a.png')).toBe(false);
  });

  it('lists nothing for a prefix that does not exist yet', async () => {
    expect(await driver.list('products')).toEqual([]);
  });

  it('refuses a key that could escape the store', async () => {
    for (const key of ['../secrets.env', 'products/../../etc/passwd', '/absolute/a.png', '']) {
      await expect(driver.put(key, PNG, { contentType: 'image/png' })).rejects.toThrow(
        /Unsafe storage key/
      );
    }
  });
});

describe('image keys', () => {
  it('names an object from the detected content type, never from the client filename', () => {
    expect(productImageKey('image/webp')).toMatch(
      new RegExp(`^${PRODUCT_IMAGE_PREFIX}/\\d+-[0-9a-f]{6}\\.webp$`)
    );
    expect(extensionForContentType('image/jpeg')).toBe('.jpg');
    expect(extensionForContentType('image/gif')).toBeNull();
    expect(() => productImageKey('image/svg+xml')).toThrow(/Unsupported image content type/);
  });
});

describe('upload validation', () => {
  it('identifies the formats it accepts and rejects everything else', () => {
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(WEBP)).toBe('image/webp');
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" />'))).toBeNull();
    expect(detectImageType(Buffer.from([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });

  it('rejects a file whose bytes disagree with its extension', () => {
    const res = response();
    const next = vi.fn();
    validateImageBytes(
      { file: { originalname: 'evil.png', buffer: JPEG } } as unknown as Request,
      res,
      next
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: expect.stringContaining('does not match') },
    });
  });

  it('rejects a file that is not an image at all, and an empty one', () => {
    for (const buffer of [Buffer.from('#!/bin/sh\nrm -rf /'), Buffer.alloc(0)]) {
      const res = response();
      const next = vi.fn();
      validateImageBytes(
        { file: { originalname: 'x.png', buffer } } as unknown as Request,
        res,
        next
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    }
  });

  it('pins the detected type onto the file so nothing downstream trusts the client', () => {
    const file = { originalname: 'photo.jpg', buffer: JPEG, mimetype: 'image/png' };
    const next = vi.fn();
    validateImageBytes({ file } as unknown as Request, response(), next);
    expect(next).toHaveBeenCalled();
    expect(file.mimetype).toBe('image/jpeg');
  });

  it('keeps the 2MB ceiling and the extension allowlist on the multer instance', () => {
    const upload = createImageUpload() as unknown as {
      limits: { fileSize: number; files: number };
      fileFilter: (
        req: unknown,
        file: { originalname: string },
        cb: (e: Error | null, ok?: boolean) => void
      ) => void;
    };
    expect(upload.limits).toMatchObject({ fileSize: 2 * 1024 * 1024, files: 1 });

    const rejected: string[] = [];
    for (const name of ['x.svg', 'x.gif', 'x.php', 'x.png.exe', 'x']) {
      upload.fileFilter({}, { originalname: name }, (err) => {
        if (err) rejected.push(name);
      });
    }
    expect(rejected).toEqual(['x.svg', 'x.gif', 'x.php', 'x.png.exe', 'x']);
  });
});

describe('product image routes', () => {
  function imageRouteHandlers(method: 'post' | 'delete') {
    const layer = (
      productsRouter as unknown as {
        stack: Array<{
          route?: {
            path: string;
            methods: Record<string, boolean>;
            stack: Array<{ handle: (req: unknown, res: unknown, next: unknown) => void }>;
          };
        }>;
      }
    ).stack.find((l) => l.route?.path === '/:id/image' && l.route.methods[method]);
    expect(layer).toBeDefined();
    return layer!.route!.stack.map((s) => s.handle);
  }

  async function runChain(
    handlers: Array<(req: unknown, res: unknown, next: unknown) => void>,
    req: Partial<Request>
  ) {
    const res = response();
    for (const handler of handlers) {
      let advanced = false;
      await new Promise<void>((resolve) => {
        handler(req, res, () => {
          advanced = true;
          resolve();
        });
        if (!advanced) setImmediate(resolve);
      });
      if (!advanced) break;
    }
    return res;
  }

  it('rejects an unauthenticated upload before any storage work happens', async () => {
    const driver = new FakeDriver();
    setStorage(driver);
    const res = await runChain(imageRouteHandlers('post'), { headers: {}, params: { id: '1' } });
    expect(res.statusCode).toBe(401);
    expect(driver.objects.size).toBe(0);
  });

  it('rejects a non-Admin upload and a non-Admin delete', async () => {
    const token = jwt.sign(
      { id: 2, role: 'Cashier', email: 'sarah@moon.com' },
      process.env.JWT_SECRET as string
    );
    for (const method of ['post', 'delete'] as const) {
      const res = await runChain(imageRouteHandlers(method), {
        headers: { authorization: `Bearer ${token}` },
        params: { id: '1' },
      });
      expect(res.statusCode).toBe(403);
    }
  });
});

describe('product image lifecycle', () => {
  let driver: FakeDriver;
  const controller = new ProductsController();

  beforeEach(() => {
    driver = new FakeDriver();
    setStorage(driver);
  });

  afterEach(() => {
    resetStorage();
    vi.restoreAllMocks();
  });

  function uploadRequest() {
    return {
      params: { id: '7' },
      file: { originalname: 'photo.png', buffer: PNG, mimetype: 'image/png' },
    } as unknown as Request;
  }

  it('stores the object, points the row at it, and releases the image it replaced', async () => {
    driver.objects.set('products/old.png', {
      body: PNG,
      contentType: 'image/png',
      lastModified: new Date(),
    });
    vi.spyOn(productsRepository, 'findById').mockResolvedValue({
      id: 7,
      status: 'active',
      image_url: '/uploads/products/old.png',
    } as never);
    const updateImage = vi.spyOn(productsRepository, 'updateImage').mockResolvedValue(undefined);

    const res = response();
    await controller.uploadImage(uploadRequest(), res, vi.fn());

    const body = res.body as { data: { image_url: string } };
    expect(body.data.image_url).toMatch(/^\/uploads\/products\/\d+-[0-9a-f]{6}\.png$/);
    expect(updateImage).toHaveBeenCalledWith(7, body.data.image_url);
    expect([...driver.objects.keys()]).toEqual([body.data.image_url.replace('/uploads/', '')]);
  });

  it('writes nothing when the product does not exist or is discontinued', async () => {
    const findById = vi.spyOn(productsRepository, 'findById');
    const next = vi.fn();

    findById.mockResolvedValueOnce(undefined as never);
    await controller.uploadImage(uploadRequest(), response(), next);

    findById.mockResolvedValueOnce({ id: 7, status: 'discontinued' } as never);
    await controller.uploadImage(uploadRequest(), response(), next);

    expect(next.mock.calls.map(([err]) => err.code)).toEqual(['NOT_FOUND', 'FORBIDDEN']);
    expect(driver.objects.size).toBe(0);
  });

  it('removes the object it just wrote when the row cannot be updated', async () => {
    vi.spyOn(productsRepository, 'findById').mockResolvedValue({
      id: 7,
      status: 'active',
      image_url: null,
    } as never);
    vi.spyOn(productsRepository, 'updateImage').mockRejectedValue(new Error('deadlock detected'));

    const next = vi.fn();
    await controller.uploadImage(uploadRequest(), response(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'deadlock detected' }));
    expect(driver.objects.size).toBe(0);
  });

  it('still succeeds when the replaced object cannot be deleted, leaving it to the sweep', async () => {
    driver.objects.set('products/old.png', {
      body: PNG,
      contentType: 'image/png',
      lastModified: new Date(),
    });
    driver.failDeleteKeys.add('products/old.png');
    vi.spyOn(productsRepository, 'findById').mockResolvedValue({
      id: 7,
      status: 'active',
      image_url: '/uploads/products/old.png',
    } as never);
    vi.spyOn(productsRepository, 'updateImage').mockResolvedValue(undefined);

    const res = response();
    await controller.uploadImage(uploadRequest(), res, vi.fn());

    expect((res.body as { data: { image_url: string } }).data.image_url).toBeTruthy();
    expect(driver.objects.has('products/old.png')).toBe(true);
  });

  it('clears the row and the object on delete, and never touches a foreign URL', async () => {
    driver.objects.set('products/live.png', {
      body: PNG,
      contentType: 'image/png',
      lastModified: new Date(),
    });
    const updateImage = vi.spyOn(productsRepository, 'updateImage').mockResolvedValue(undefined);
    const findById = vi.spyOn(productsRepository, 'findById');

    findById.mockResolvedValueOnce({
      id: 7,
      status: 'active',
      image_url: '/uploads/products/live.png',
    } as never);
    await controller.deleteImage(
      { params: { id: '7' } } as unknown as Request,
      response(),
      vi.fn()
    );
    expect(updateImage).toHaveBeenCalledWith(7, null);
    expect(driver.objects.size).toBe(0);

    driver.objects.set('products/live.png', {
      body: PNG,
      contentType: 'image/png',
      lastModified: new Date(),
    });
    findById.mockResolvedValueOnce({
      id: 8,
      status: 'active',
      image_url: 'https://cdn.example.com/hero.png',
    } as never);
    await controller.deleteImage(
      { params: { id: '8' } } as unknown as Request,
      response(),
      vi.fn()
    );
    expect(driver.objects.has('products/live.png')).toBe(true);
  });
});

describe('orphaned media sweep', () => {
  const hours = (n: number) => n * 60 * 60 * 1000;

  function driverWith(entries: Array<[string, number]>) {
    const driver = new FakeDriver();
    for (const [key, ageHours] of entries) {
      driver.objects.set(key, {
        body: PNG,
        contentType: 'image/png',
        lastModified: new Date(Date.now() - hours(ageHours)),
      });
    }
    return driver;
  }

  function poolReturning(urls: string[]) {
    return {
      query: vi.fn(async () => ({ rows: urls.map((image_url) => ({ image_url })) })),
    } as never;
  }

  it('deletes only what is unreferenced and old enough', async () => {
    const driver = driverWith([
      ['products/referenced.png', 48],
      ['products/orphan.png', 48],
      ['products/just-uploaded.png', 1],
    ]);

    const outcome = await sweepOrphanedMedia({
      pool: poolReturning(['/uploads/products/referenced.png', 'https://cdn.example.com/x.png']),
      storage: driver,
      minAgeMs: hours(24),
    });

    expect(outcome).toEqual({ scanned: 3, deleted: 1, skippedRecent: 1, failed: 0 });
    expect([...driver.objects.keys()].sort()).toEqual([
      'products/just-uploaded.png',
      'products/referenced.png',
    ]);
  });

  it('deletes nothing when the reference query fails', async () => {
    const driver = driverWith([['products/orphan.png', 48]]);
    const pool = {
      query: vi.fn(async () => {
        throw new Error('connection reset');
      }),
    } as never;

    await expect(
      sweepOrphanedMedia({ pool, storage: driver, minAgeMs: hours(24) })
    ).rejects.toThrow('connection reset');
    expect(driver.objects.size).toBe(1);
  });

  it('deletes nothing after the documented CDN migration, when every row is legacy', async () => {
    // Regression: `MEDIA_PUBLIC_BASE_URL` moves to an absolute base while every existing
    // row still holds `/uploads/...`. A driver that stopped recognising those URLs would
    // report the whole catalogue as unreferenced and delete it.
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'moon-cdn-'));
    try {
      const cdn = new LocalStorageDriver({ root, baseUrl: 'https://cdn.example.com/media' });
      await cdn.put('products/legacy-a.png', PNG, { contentType: 'image/png' });
      await cdn.put('products/legacy-b.png', PNG, { contentType: 'image/png' });
      await cdn.put('products/orphan.png', PNG, { contentType: 'image/png' });

      const outcome = await sweepOrphanedMedia({
        pool: poolReturning([
          '/uploads/products/legacy-a.png',
          'https://cdn.example.com/media/products/legacy-b.png',
          'https://images.unsplash.com/photo-1.jpg',
        ]),
        storage: cdn,
        // Everything was just written, so the sweep is aged past the grace window on
        // purpose: age must not be the reason nothing was deleted, only the mapping.
        minAgeMs: hours(1),
        now: new Date(Date.now() + hours(2)),
      });

      expect(outcome).toMatchObject({ scanned: 3, deleted: 1 });
      expect((await cdn.list('products')).map((o) => o.key).sort()).toEqual([
        'products/legacy-a.png',
        'products/legacy-b.png',
      ]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('refuses to delete anything when a reference it owns cannot be resolved', async () => {
    const driver = driverWith([['products/orphan.png', 48]]);
    driver.unreadableUrls.add('/uploads/products/mangled');

    await expect(
      sweepOrphanedMedia({
        pool: poolReturning(['/uploads/products/mangled']),
        storage: driver,
        minAgeMs: hours(24),
      })
    ).rejects.toThrow(/Refusing to sweep/);
    expect(driver.objects.size).toBe(1);
  });

  it('counts a failed delete instead of aborting the sweep', async () => {
    const driver = driverWith([
      ['products/stuck.png', 48],
      ['products/orphan.png', 48],
    ]);
    driver.failDeleteKeys.add('products/stuck.png');

    const outcome = await sweepOrphanedMedia({
      pool: poolReturning([]),
      storage: driver,
      minAgeMs: hours(24),
    });

    expect(outcome).toMatchObject({ scanned: 2, deleted: 1, failed: 1 });
    expect(driver.objects.has('products/stuck.png')).toBe(true);
  });
});

/**
 * The S3-compatible driver (#82).
 *
 * The URL logic is what carries the risk, so that is what is asserted hardest. The orphan
 * sweep deletes objects no database row references, and it decides "referenced" by asking
 * the driver two questions. A driver that answers them wrong does not fail loudly — it
 * deletes a shop's product images on its first run after a migration. #75 shipped that bug
 * against the local driver and it was caught in review rather than by a test; this is that
 * test for the new one.
 *
 * Network calls are mocked at `S3Client.prototype.send`, which keeps the suite hermetic
 * without another dependency. What that asserts is the command this driver builds and how
 * it reads the reply — not that AWS works.
 */
describe('S3StorageDriver', () => {
  const CDN = 'https://cdn.example.com/media';

  function s3Driver(baseUrl = CDN) {
    return new S3StorageDriver({ bucket: 'moon-media', region: 'us-east-1', baseUrl });
  }

  afterEach(() => vi.restoreAllMocks());

  it('round-trips a key through its public URL', () => {
    const s3 = s3Driver();
    expect(s3.publicUrl('products/a.png')).toBe(`${CDN}/products/a.png`);
    expect(s3.keyFromUrl(`${CDN}/products/a.png`)).toBe('products/a.png');
    // Same-origin form of the configured base, for a CDN fronting this API.
    expect(s3.keyFromUrl('/media/products/a.png')).toBe('products/a.png');
  });

  it('still owns the legacy /uploads URLs it never wrote', () => {
    // The documented migration copies the tree into a bucket and points the base at a CDN.
    // Rows written before that stay relative. This driver never emits `/uploads/...`, but
    // those rows are still its objects under their old address — and a driver that
    // disowned them would make the sweep read every one as unreferenced.
    const s3 = s3Driver();
    expect(s3.keyFromUrl('/uploads/products/legacy.png')).toBe('products/legacy.png');
    expect(s3.ownsUrl('/uploads/products/legacy.png')).toBe(true);
  });

  it('leaves an image belonging to somebody else alone', () => {
    const s3 = s3Driver();
    expect(s3.keyFromUrl('https://other.example.com/hero.png')).toBeNull();
    expect(s3.ownsUrl('https://other.example.com/hero.png')).toBe(false);
  });

  it('separates "not mine" from "mine but unreadable"', () => {
    // The distinction the sweep depends on. `null` from both would be indistinguishable
    // from an absent reference, and the sweep would then delete on missing information.
    const s3 = s3Driver();
    expect(s3.keyFromUrl('/uploads/products/../../etc/passwd')).toBeNull();
    expect(s3.ownsUrl('/uploads/products/../../etc/passwd')).toBe(true);
  });

  it('reads a missing object as absent, but never an unreadable one', async () => {
    const s3 = s3Driver();
    const send = vi.spyOn(S3Client.prototype, 'send');

    send.mockRejectedValueOnce(Object.assign(new Error('nope'), { name: 'NotFound' }));
    expect(await s3.exists('products/a.png')).toBe(false);

    // Access denied is not "absent". Reporting it as absent would let the sweep treat an
    // object it merely cannot read as one that is not there.
    send.mockRejectedValueOnce(
      Object.assign(new Error('denied'), {
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      })
    );
    await expect(s3.exists('products/a.png')).rejects.toThrow(/denied/);
  });

  it('pages a truncated listing to the end', async () => {
    // A listing read as complete when it was not would hide objects from the sweep, and
    // hide from the reader that they were hidden.
    const s3 = s3Driver();
    const now = new Date();
    vi.spyOn(S3Client.prototype, 'send')
      .mockResolvedValueOnce({
        Contents: [{ Key: 'products/a.png', Size: 1, LastModified: now }],
        IsTruncated: true,
        NextContinuationToken: 'page-2',
      } as never)
      .mockResolvedValueOnce({
        Contents: [{ Key: 'products/b.png', Size: 2, LastModified: now }],
        IsTruncated: false,
      } as never);

    expect((await s3.list('products')).map((o) => o.key)).toEqual([
      'products/a.png',
      'products/b.png',
    ]);
  });

  it('refuses a key that could escape the store', async () => {
    const s3 = s3Driver();
    await expect(s3.put('../secrets.env', PNG, { contentType: 'image/png' })).rejects.toThrow(
      /Unsafe storage key/
    );
  });

  /**
   * The scenario the whole driver had to get right, end to end: a legacy row this store
   * owns but cannot resolve must STOP the sweep, not be passed over as unreferenced.
   */
  it('makes the sweep abort rather than delete when a row it owns will not resolve', async () => {
    const s3 = s3Driver();
    vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({
      Contents: [
        {
          Key: 'products/legacy.png',
          Size: 1,
          LastModified: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
      ],
      IsTruncated: false,
    } as never);

    const pool = {
      query: vi.fn(async () => ({
        // Ours by prefix, unresolvable as a key. The sweep must read this as missing
        // information about what is referenced, not as an absent reference.
        rows: [{ image_url: '/uploads/products/../../etc/passwd' }],
      })),
    } as never;

    await expect(
      sweepOrphanedMedia({ pool, storage: s3, minAgeMs: 24 * 60 * 60 * 1000 })
    ).rejects.toThrow(/Refusing to sweep/);
  });
});

describe('createStorageDriver for s3', () => {
  const ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL };
    resetEnvCache();
    resetStorage();
  });

  function withEnv(vars: Record<string, string>) {
    Object.assign(process.env, vars);
    resetEnvCache();
  }

  it('refuses to start without a bucket rather than falling back to local', () => {
    // Falling back would start an instance writing to a container filesystem while its
    // operator believed media was going to a bucket — a loss that surfaces at the next
    // redeploy, long after the cause.
    withEnv({ MEDIA_STORAGE_DRIVER: 's3', MEDIA_PUBLIC_BASE_URL: 'https://cdn.example.com/m' });
    expect(() => createStorageDriver()).toThrow(/requires MEDIA_S3_BUCKET/);
  });

  it('refuses to start without a public base URL', () => {
    // There is no safe default: a wrong guess writes unreachable URLs into the database.
    withEnv({ MEDIA_STORAGE_DRIVER: 's3', MEDIA_S3_BUCKET: 'moon-media' });
    expect(() => createStorageDriver()).toThrow(/requires MEDIA_PUBLIC_BASE_URL/);
  });

  it('builds the driver when both are present', () => {
    withEnv({
      MEDIA_STORAGE_DRIVER: 's3',
      MEDIA_S3_BUCKET: 'moon-media',
      MEDIA_S3_REGION: 'us-east-1',
      MEDIA_PUBLIC_BASE_URL: 'https://cdn.example.com/m',
    });
    const built = createStorageDriver();
    expect(built.name).toBe('s3');
    expect(built.publicUrl('products/a.png')).toBe('https://cdn.example.com/m/products/a.png');
  });

  it('still defaults to local when nothing is configured', () => {
    delete process.env.MEDIA_STORAGE_DRIVER;
    resetEnvCache();
    expect(createStorageDriver().name).toBe('local');
  });
});
