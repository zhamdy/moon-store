import { withTransaction } from '../../../database/transaction';
import { ICollectionsRepository, collectionsRepository as defaultRepo } from './repository';
import {
  CollectionFilters,
  CreateCollectionDTO,
  UpdateCollectionDTO,
  CollectionRecord,
  CollectionDetailRecord,
  CollectionConflictError,
} from './types';

export class CollectionsService {
  constructor(private repo: ICollectionsRepository = defaultRepo) {}

  getRepository(): ICollectionsRepository {
    return this.repo;
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
      const collection = await this.repo.create(data, client);
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

      const updated = await this.repo.update(id, data, client);
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
