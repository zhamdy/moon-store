import { IVendorsRepository, vendorsRepository as defaultRepo } from './repository';
import {
  CreateVendorPayoutDTO,
  VendorDTO,
  VendorFilters,
  VendorPayoutRecord,
  VendorRecord,
} from './types';

export class VendorsService {
  constructor(private repo: IVendorsRepository = defaultRepo) {}

  getRepository(): IVendorsRepository {
    return this.repo;
  }

  async list(
    filters: VendorFilters
  ): Promise<{ rows: VendorRecord[]; total: number; page: number; limit: number }> {
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

  async findById(id: number | string): Promise<VendorRecord | null> {
    return this.repo.findById(id);
  }

  async create(data: VendorDTO): Promise<VendorRecord> {
    return this.repo.create(data);
  }

  async update(id: number | string, data: VendorDTO): Promise<VendorRecord | null> {
    return this.repo.update(id, data);
  }

  async getPayouts(vendorId: number | string): Promise<VendorPayoutRecord[]> {
    return this.repo.getPayouts(vendorId);
  }

  async createPayout(
    vendorId: number | string,
    data: CreateVendorPayoutDTO,
    createdBy: number
  ): Promise<VendorPayoutRecord> {
    if (!data.amount || data.amount <= 0) {
      throw new Error('Valid payout amount required');
    }
    return this.repo.createPayout(vendorId, data, createdBy);
  }
}

export const vendorsService = new VendorsService();
