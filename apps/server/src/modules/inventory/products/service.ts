import {
  generateSku,
  generateBarcode,
  createProduct,
  updateProduct,
  bulkDeleteProducts,
  bulkUpdateProducts,
  importProducts,
  adjustStock,
  createVariant,
  updateVariant,
  deleteVariant,
  batchGenerateBarcodes,
} from '../../../../services/productService';
import logger from '../../../../lib/logger';
import { IProductsRepository, productsRepository as defaultRepo } from './repository';
import { PRODUCT_GALLERY_MAX, ProductFilters, ProductImageRecord } from './types';
import { withTransaction } from '../../../database/transaction';
import { PublicError } from '../../../http/errors';
import { getStorage, productImageKey } from '../../../storage';

export interface GalleryUpload {
  buffer: Buffer;
  /** The type `validateImageBytes` detected, never the client's claim. */
  mimetype: string;
}

export const GALLERY_FULL_CODE = 'GALLERY_FULL';
export const IMAGE_SET_MISMATCH_CODE = 'IMAGE_SET_MISMATCH';

function galleryFull(): PublicError {
  const message = `A product can have at most ${PRODUCT_GALLERY_MAX} gallery images`;
  return new PublicError('CONFLICT', message, [
    { field: 'image', code: GALLERY_FULL_CODE, message },
  ]);
}

function assertGalleryWritable(product: { status?: string } | null): void {
  if (!product) throw new PublicError('NOT_FOUND', 'Product not found');
  // The same refusal the primary image routes give.
  if (product.status === 'discontinued') {
    throw new PublicError('FORBIDDEN', 'Cannot modify a discontinued product');
  }
}

export class ProductsService {
  constructor(private repo: IProductsRepository = defaultRepo) {}

  getRepository(): IProductsRepository {
    return this.repo;
  }

  list(filters: ProductFilters) {
    return withTransaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      return this.repo.list(filters, client);
    });
  }

  lookup(ids: number[], includeInactive: boolean) {
    return this.repo.lookup(ids, includeInactive);
  }

  generateSku(categoryId: number) {
    return generateSku(categoryId);
  }

  generateBarcode() {
    return generateBarcode();
  }

  createProduct(data: any) {
    return createProduct(data);
  }

  updateProduct(id: string | number, data: any, userId: number) {
    return updateProduct(id, data, userId);
  }

  bulkDeleteProducts(ids: number[]) {
    return bulkDeleteProducts(ids);
  }

  bulkUpdateProducts(ids: number[], updates: any) {
    return bulkUpdateProducts(ids, updates);
  }

  importProducts(products: unknown[]) {
    return importProducts(products);
  }

  adjustStock(productId: number, input: any, userId: number) {
    return adjustStock(productId, input, userId);
  }

  createVariant(productId: number, data: any) {
    return createVariant(productId, data);
  }

  updateVariant(productId: string | number, variantId: string | number, data: any) {
    return updateVariant(productId, variantId, data);
  }

  deleteVariant(productId: string | number, variantId: string | number) {
    return deleteVariant(productId, variantId);
  }

  batchGenerateBarcodes(productIds: number[]) {
    return batchGenerateBarcodes(productIds);
  }

  async listImages(productId: number): Promise<ProductImageRecord[]> {
    const product = await this.repo.findById(productId);
    if (!product) throw new PublicError('NOT_FOUND', 'Product not found');
    return this.repo.listImages(productId);
  }

  /**
   * Appends a gallery image at the next position.
   *
   * The cap is checked twice. The unlocked pre-check refuses the common case before any
   * object is written; the check under the product row lock is the one that holds, since a
   * concurrent append can take the last slot in between. Whatever fails after the object is
   * written -- that second check or the insert -- removes the object before rethrowing, so a
   * refused upload leaves nothing stored (the sweep is the backstop if that delete fails).
   */
  async addImage(productId: number, file: GalleryUpload): Promise<ProductImageRecord> {
    assertGalleryWritable(await this.repo.findById(productId));
    if ((await this.repo.listImages(productId)).length >= PRODUCT_GALLERY_MAX) {
      throw galleryFull();
    }

    const storage = getStorage();
    const key = productImageKey(file.mimetype);
    await storage.put(key, file.buffer, { contentType: file.mimetype });
    const imageUrl = storage.publicUrl(key);

    try {
      return await withTransaction(async (client) => {
        assertGalleryWritable(await this.repo.lockForGallery(productId, client));
        const current = await this.repo.listImages(productId, client);
        if (current.length >= PRODUCT_GALLERY_MAX) throw galleryFull();
        return this.repo.appendImage(productId, imageUrl, client);
      });
    } catch (err) {
      await storage.delete(key).catch((cleanupErr: Error) =>
        logger.error('Could not remove gallery image after a refused append', {
          key,
          error: cleanupErr.message,
        })
      );
      throw err;
    }
  }

  /** Row first, then the object best-effort: a leftover object is collectable, a dangling row is not. */
  async removeImage(productId: number, imageId: number): Promise<void> {
    const removed = await withTransaction(async (client) => {
      assertGalleryWritable(await this.repo.lockForGallery(productId, client));
      return this.repo.deleteImageRow(productId, imageId, client);
    });
    if (!removed) throw new PublicError('NOT_FOUND', 'Product image not found');

    const storage = getStorage();
    const key = storage.keyFromUrl(removed.image_url);
    if (key) {
      await storage.delete(key).catch((err: Error) =>
        logger.warn('Deleted gallery image could not be removed; left for the sweep', {
          key,
          error: err.message,
        })
      );
    }
  }

  /**
   * Rewrites the gallery order from the complete ordered id list.
   *
   * A list that is not exactly the current set -- one missing, one foreign, one repeated --
   * is refused before anything is written: a partial list has no honest meaning, since the
   * images it leaves out would need positions nobody chose.
   */
  async reorderImages(productId: number, imageIds: number[]): Promise<ProductImageRecord[]> {
    return withTransaction(async (client) => {
      assertGalleryWritable(await this.repo.lockForGallery(productId, client));
      const current = await this.repo.listImages(productId, client);
      const currentIds = new Set(current.map((image) => image.id));
      const isPermutation =
        imageIds.length === current.length &&
        new Set(imageIds).size === imageIds.length &&
        imageIds.every((id) => currentIds.has(id));
      if (!isPermutation) {
        const message = 'imageIds must list every image of this product exactly once';
        throw new PublicError('VALIDATION_ERROR', message, [
          { field: 'imageIds', code: IMAGE_SET_MISMATCH_CODE, message },
        ]);
      }
      await this.repo.rewriteImagePositions(productId, imageIds, client);
      return this.repo.listImages(productId, client);
    });
  }
}

export const productsService = new ProductsService();
