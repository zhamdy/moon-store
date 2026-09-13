import { withTransaction } from '../../../database/transaction';
import { IStockCountsRepository, stockCountsRepository as defaultRepo } from './repository';
import {
  StockCountFilters,
  CreateStockCountDTO,
  UpdateStockCountItemDTO,
  StockCountRecord,
  StockCountDetail,
  StockCountItemRecord,
} from './types';

export class StockCountsService {
  constructor(private repo: IStockCountsRepository = defaultRepo) {}

  getRepository(): IStockCountsRepository {
    return this.repo;
  }

  list(filters: StockCountFilters): Promise<{ rows: StockCountRecord[]; total: number }> {
    return this.repo.list(filters);
  }

  async findById(id: number | string): Promise<StockCountDetail | null> {
    const count = await this.repo.findById(id);
    if (!count) return null;

    const items = await this.repo.findItemsByCountId(id);
    return {
      ...count,
      items,
    };
  }

  async createCount(
    data: CreateStockCountDTO,
    userId: number
  ): Promise<{ success: boolean; data?: { id: number }; error?: string }> {
    const products = await this.repo.findActiveProductsForCount(data.category_id);
    if (products.length === 0) {
      return { success: false, error: 'No active products found to count' };
    }

    const countId = await withTransaction(async (client) => {
      const newCountId = await this.repo.createStockCount(
        {
          category_id: data.category_id || null,
          notes: data.notes || null,
          created_by: userId,
        },
        client
      );

      const items = products.map((row) => ({
        product_id: row.id,
        variant_id: row.variant_id || null,
        expected_qty: row.variant_id ? (row.variant_stock ?? 0) : row.stock,
      }));

      await this.repo.createStockCountItems(newCountId, items, client);
      return newCountId;
    });

    return { success: true, data: { id: countId } };
  }

  async updateCountItem(
    countId: number | string,
    itemId: number | string,
    data: UpdateStockCountItemDTO
  ): Promise<{ success: boolean; data?: StockCountItemRecord; error?: string }> {
    const item = await this.repo.findItemById(itemId, countId);
    if (!item) {
      return { success: false, error: 'Count item not found' };
    }

    const variance = data.counted_qty - item.expected_qty;
    const updated = await this.repo.updateCountItem(
      itemId,
      data.counted_qty,
      variance,
      data.notes || null
    );

    if (!updated) {
      return { success: false, error: 'Failed to update count item' };
    }

    return { success: true, data: updated };
  }

  async completeCount(
    id: number | string,
    userId: number,
    applyAdjustments = true
  ): Promise<{ success: boolean; error?: string; status?: number }> {
    const stockCount = await this.repo.findById(id);
    if (!stockCount) {
      return { success: false, error: 'Stock count not found', status: 404 };
    }

    if (stockCount.status === 'completed') {
      return { success: false, error: 'Stock count is already completed', status: 400 };
    }

    await withTransaction(async (client) => {
      if (applyAdjustments) {
        const items = await this.repo.findVarianceItemsForCount(id, client);

        for (const item of items) {
          if (item.variant_id) {
            await this.repo.updateVariantStock(item.variant_id, item.counted_qty!, client);
          } else {
            await this.repo.updateProductStock(item.product_id, item.counted_qty!, client);
          }

          await this.repo.createStockAdjustment(
            {
              product_id: item.product_id,
              previous_qty: item.expected_qty,
              new_qty: item.counted_qty!,
              delta: item.variance!,
              reason: 'Stock Count',
              user_id: userId,
            },
            client
          );
        }
      }

      await this.repo.completeCount(id, client);
    });

    return { success: true };
  }

  async cancelCount(id: number | string): Promise<{ success: boolean; error?: string }> {
    const cancelled = await this.repo.cancelCount(id);
    if (!cancelled) {
      return { success: false, error: 'Only in-progress counts can be cancelled' };
    }
    return { success: true };
  }
}

export const stockCountsService = new StockCountsService();
