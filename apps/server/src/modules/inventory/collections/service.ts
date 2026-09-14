import logger from '../../../../lib/logger';
import { withTransaction } from '../../../database/transaction';
import { PublicError } from '../../../http/errors';
import { getStorage, productImageKey } from '../../../storage';
import { ICollectionsRepository, collectionsRepository as defaultRepo } from './repository';
import {
  CollectionFilters,
  CreateCollectionDTO,
  UpdateCollectionDTO,
  CollectionRecord,
  CollectionDetailRecord,
  CollectionConflictError,
} from './types';
import { assertSlugAvailable, assignGeneratedSlug, rethrowSlugViolation } from '../shared/slug';

export class CollectionsService {
  constructor(private repo: ICollectionsRepository = defaultRepo) {}

  getRepository(): ICollectionsRepository {
    return this.repo;
  }

  /**
   * Replaces the collection image, in the order the product image route uses: validate,
   * write the object, point the row at it, then release the previous object best-effort.
   * The key reuses the `products/` prefix because that is the prefix the sweep lists.
   */
  async setImage(
    id: number | string,
    file: { buffer: Buffer; mimetype: string }
  ): Promise<{ image_url: string }> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new PublicError('NOT_FOUND', 'Collection not found');

    const storage = getStorage();
    const key = productImageKey(file.mimetype);
    await storage.put(key, file.buffer, { contentType: file.mimetype });
    const imageUrl = storage.publicUrl(key);

    let updated: boolean;
    try {
      updated = await this.repo.updateImage(id, imageUrl);
    } catch (err) {
      await this.releaseObject(key, 'Could not remove image after a failed collection update');
      throw err;
    }
    if (!updated) {
      // Deleted between the read and the write: nothing references the new object.
      await this.releaseObject(key, 'Could not remove image of a vanished collection');
      throw new PublicError('NOT_FOUND', 'Collection not found');
    }

    const previousKey = existing.image_url ? storage.keyFromUrl(existing.image_url) : null;
    if (previousKey && previousKey !== key) {
      await this.releaseObject(previousKey, 'Replaced collection image could not be removed');
    }
    return { image_url: imageUrl };
  }

  /** Clears the row first, then the object best-effort. */
  async clearImage(id: number | string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new PublicError('NOT_FOUND', 'Collection not found');
    await this.repo.updateImage(id, null);

    const key = existing.image_url ? getStorage().keyFromUrl(existing.image_url) : null;
    if (key) await this.releaseObject(key, 'Deleted collection image could not be removed');
  }

  private async releaseObject(key: string, message: string): Promise<void> {
    await getStorage()
      .delete(key)
      .catch((err: Error) =>
        logger.warn(`${message}; left for the sweep`, { key, error: err.message })
      );
  }

  list(filters: CollectionFilters): Promise<{ rows: CollectionRecord[]; total: number }> {
    return this.repo.list(filters);
  }

  async findById(id: number | string): Promise<CollectionDetailRecord | null> {
    const collection = await this.repo.findById(id);
    if (!collection) return null;

    const products = await this.repo.findProductsByCollectionId(id);
    return {
      ...collection,
      products,
    };
  }

  async create(data: CreateCollectionDTO): Promise<CollectionRecord> {
    return withTransaction(async (client) => {
      if (data.slug) await assertSlugAvailable(client, 'collections', data.slug);
      let collection: CollectionRecord;
      try {
        collection = await this.repo.create(data, client);
      } catch (error) {
        rethrowSlugViolation(error, 'collections');
      }
      if (!collection.slug) {
        // In the same transaction, so no committed collection is ever without its slug.
        collection = await assignGeneratedSlug<CollectionRecord>(
          client,
          'collections',
          collection.id,
          [data.name_en]
        );
      }
      if (data.product_ids && data.product_ids.length > 0) {
        await this.repo.addProducts(collection.id, data.product_ids, client);
      }
      return collection;
    });
  }

  /**
   * A whole-set replace, guarded by the caller's version token (#81).
   *
   * The existence check used to run on its own unlocked read before the transaction
   * opened, which made it a second stale read on a path whose entire problem is stale
   * reads. Both the check and the guard now happen against the locked row, inside the
   * transaction that writes — otherwise the row could move between deciding to write
   * and writing.
   *
   * A stale token throws rather than returning `success: false`, because it is not the
   * same kind of answer: "no such collection" is about the request's target, while this
   * is a domain refusal the controller has to turn into a typed 409. Same shape as
   * `InsufficientStockError` on the POS path.
   */
  async update(
    id: number | string,
    data: UpdateCollectionDTO
  ): Promise<{ success: boolean; data?: CollectionRecord; error?: string }> {
    return withTransaction(async (client) => {
      const current = await this.repo.lockById(id, client);
      if (!current) {
        return { success: false, error: 'Collection not found' };
      }

      if (data.expected_updated_at !== undefined && data.expected_updated_at !== current.token) {
        throw new CollectionConflictError(
          'This collection was changed by someone else after you opened it. Reload to see the current products before saving.'
        );
      }

      if (data.slug) {
        await assertSlugAvailable(client, 'collections', data.slug, {
          column: 'id',
          value: Number(id),
        });
      }
      let updated: CollectionRecord | null;
      try {
        updated = await this.repo.update(id, data, client);
      } catch (error) {
        rethrowSlugViolation(error, 'collections');
      }
      if (data.product_ids !== undefined) {
        await this.repo.deleteProductsByCollectionId(id, client);
        if (data.product_ids.length > 0) {
          await this.repo.addProducts(id, data.product_ids, client);
        }
      }

      return { success: true, data: updated! };
    });
  }

  async delete(id: number | string): Promise<{ success: boolean; error?: string }> {
    const deleted = await this.repo.delete(id);
    if (!deleted) {
      return { success: false, error: 'Collection not found' };
    }
    return { success: true };
  }
}

export const collectionsService = new CollectionsService();
