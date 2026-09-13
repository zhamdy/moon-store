import { IWarrantyRepository, warrantyRepository as defaultRepo } from './repository';
import {
  CreateWarrantyClaimDTO,
  UpdateWarrantyClaimDTO,
  WarrantyClaimRecord,
  WarrantyFilters,
} from './types';

export class WarrantyService {
  constructor(private repo: IWarrantyRepository = defaultRepo) {}

  getRepository(): IWarrantyRepository {
    return this.repo;
  }

  async list(
    filters: WarrantyFilters
  ): Promise<{ rows: WarrantyClaimRecord[]; total: number; page: number; limit: number }> {
    const pageNum = filters.page ? Number(filters.page) : 1;
    const limitNum = filters.pageSize;

    const result = await this.repo.list({
      ...filters,
      page: pageNum,
      pageSize: limitNum,
    });

    return {
      rows: result.rows,
      total: result.total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async findById(id: number | string): Promise<WarrantyClaimRecord | null> {
    return this.repo.findById(id);
  }

  async create(data: CreateWarrantyClaimDTO): Promise<WarrantyClaimRecord> {
    return this.repo.create(data);
  }

  async update(
    id: number | string,
    data: UpdateWarrantyClaimDTO
  ): Promise<WarrantyClaimRecord | null> {
    return this.repo.update(id, data);
  }
}

export const warrantyService = new WarrantyService();
