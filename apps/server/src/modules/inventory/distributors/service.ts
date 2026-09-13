import { IDistributorsRepository, distributorsRepository as defaultRepo } from './repository';
import { CreateDistributorDTO, UpdateDistributorDTO, DistributorRecord } from './types';

export class DistributorsService {
  constructor(private repo: IDistributorsRepository = defaultRepo) {}

  getRepository(): IDistributorsRepository {
    return this.repo;
  }

  findAll(): Promise<DistributorRecord[]> {
    return this.repo.findAll();
  }

  findById(id: number | string): Promise<DistributorRecord | null> {
    return this.repo.findById(id);
  }

  create(data: CreateDistributorDTO): Promise<DistributorRecord> {
    return this.repo.create(data);
  }

  update(id: number | string, data: UpdateDistributorDTO): Promise<DistributorRecord | null> {
    return this.repo.update(id, data);
  }

  countProducts(id: number | string): Promise<number> {
    return this.repo.countProducts(id);
  }

  async delete(id: number | string): Promise<{ success: boolean; error?: string }> {
    const productCount = await this.repo.countProducts(id);
    if (productCount > 0) {
      return { success: false, error: 'Cannot delete distributor with associated products' };
    }
    const deleted = await this.repo.delete(id);
    if (!deleted) {
      return { success: false, error: 'Distributor not found' };
    }
    return { success: true };
  }
}

export const distributorsService = new DistributorsService();
