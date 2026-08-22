import { withTransaction } from '../../../database/transaction';
import { ICollectionsRepository, collectionsRepository as defaultRepo } from './repository';
import {
  CollectionFilters,
  CreateCollectionDTO,
  UpdateCollectionDTO,
  CollectionRecord,
  CollectionDetailRecord,
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

  async update(
    id: number | string,
    data: UpdateCollectionDTO
  ): Promise<{ success: boolean; data?: CollectionRecord; error?: string }> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return { success: false, error: 'Collection not found' };
    }

    const updated = await withTransaction(async (client) => {
      const c = await this.repo.update(id, data, client);
      if (data.product_ids !== undefined) {
        await this.repo.deleteProductsByCollectionId(id, client);
        if (data.product_ids.length > 0) {
          await this.repo.addProducts(id, data.product_ids, client);
        }
      }
      return c;
    });

    return { success: true, data: updated! };
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
