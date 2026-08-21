import {
  IStockAdjustmentsRepository,
  stockAdjustmentsRepository as defaultRepo,
} from './repository';
import { StockAdjustmentFilters, StockAdjustmentRecord } from './types';

export class StockAdjustmentsService {
  constructor(private repo: IStockAdjustmentsRepository = defaultRepo) {}

  getRepository(): IStockAdjustmentsRepository {
    return this.repo;
  }

  list(filters: StockAdjustmentFilters): Promise<{ rows: StockAdjustmentRecord[]; total: number }> {
    return this.repo.list(filters);
  }
}

export const stockAdjustmentsService = new StockAdjustmentsService();
