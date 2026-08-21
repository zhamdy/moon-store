import { withTransaction } from '../../../database/transaction';
import { IBundlesRepository, bundlesRepository as defaultRepo } from './repository';
import {
  BundleFilters,
  CreateBundleDTO,
  UpdateBundleDTO,
  BundleRecord,
  BundleDetailRecord,
} from './types';

export class BundlesService {
  constructor(private repo: IBundlesRepository = defaultRepo) {}

  getRepository(): IBundlesRepository {
    return this.repo;
  }

  list(filters: BundleFilters): Promise<{ rows: BundleRecord[]; total: number }> {
    return this.repo.list(filters);
  }

  async findById(id: number | string): Promise<BundleDetailRecord | null> {
    const bundle = await this.repo.findById(id);
    if (!bundle) return null;

    const items = await this.repo.findItemsByBundleId(id);
    return {
      ...bundle,
      items,
    };
  }

  async create(data: CreateBundleDTO): Promise<BundleRecord> {
    return withTransaction(async (client) => {
      const bundle = await this.repo.create(data, client);
      await this.repo.createBundleItems(bundle.id, data.items, client);
      return bundle;
    });
  }

  async update(
    id: number | string,
    data: UpdateBundleDTO
  ): Promise<{ success: boolean; data?: BundleRecord; error?: string }> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return { success: false, error: 'Bundle not found' };
    }

    const updated = await withTransaction(async (client) => {
      const b = await this.repo.update(id, data, client);
      await this.repo.deleteItemsByBundleId(id, client);
      await this.repo.createBundleItems(id, data.items, client);
      return b;
    });

    return { success: true, data: updated! };
  }

  async delete(id: number | string): Promise<{ success: boolean; error?: string }> {
    const deleted = await this.repo.delete(id);
    if (!deleted) {
      return { success: false, error: 'Bundle not found' };
    }
    return { success: true };
  }
}

export const bundlesService = new BundlesService();
