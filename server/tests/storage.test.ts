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
import { setStorage, resetStorage } from '../src/storage';
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

  keyFromUrl(url: string): string | null {
    return url.startsWith('/uploads/') ? url.slice('/uploads/'.length) : null;
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
    }
  });

  it('serves a configured base URL while still resolving its own keys', () => {
    const cdn = new LocalStorageDriver({ root, baseUrl: 'https://cdn.example.com/media' });
    expect(cdn.publicUrl('products/a.png')).toBe('https://cdn.example.com/media/products/a.png');
    expect(cdn.keyFromUrl('https://cdn.example.com/media/products/a.png')).toBe('products/a.png');
    expect(cdn.keyFromUrl('/uploads/products/a.png')).toBeNull();
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
