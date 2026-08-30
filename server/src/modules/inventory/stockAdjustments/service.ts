import {
  IStockAdjustmentsRepository,
  stockAdjustmentsRepository as defaultRepo,
} from './repository';
import { StockAdjustmentFilters, StockAdjustmentRecord } from './types';
import { Queryable } from '../../../database/transaction';

export class StockAdjustmentsService {
  constructor(private repo: IStockAdjustmentsRepository = defaultRepo) {}

  getRepository(): IStockAdjustmentsRepository {
    return this.repo;
  }

  list(filters: StockAdjustmentFilters): Promise<{ rows: StockAdjustmentRecord[]; total: number }> {
    return this.repo.list(filters);
  }

  /**
   * Applies a manual delta and records it. Both quantities on the audit row come from
   * the guarded UPDATE's RETURNING, so the trail records what actually happened rather
   * than what an earlier read predicted.
   *
   * @returns the before/after quantities, or null when the delta would go below zero.
   */
  async applyDelta(
    productId: number,
    delta: number,
    reason: string,
    userId: number,
    client: Queryable
  ): Promise<{ previousQty: number; newQty: number } | null> {
    const newQty = await this.repo.applyDelta(productId, delta, client);
    if (newQty === null) {
      return null;
    }

    const previousQty = newQty - delta;
    await this.repo.record(
      {
        product_id: productId,
        previous_qty: previousQty,
        new_qty: newQty,
        delta,
        reason,
        user_id: userId,
      },
      client
    );

    return { previousQty, newQty };
  }
}

export const stockAdjustmentsService = new StockAdjustmentsService();
