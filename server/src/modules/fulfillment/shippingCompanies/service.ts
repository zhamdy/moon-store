import {
  IShippingCompaniesRepository,
  shippingCompaniesRepository as defaultRepo,
} from './repository';
import { CreateShippingCompanyDTO, UpdateShippingCompanyDTO } from './types';

export class ShippingCompaniesService {
  constructor(private repo: IShippingCompaniesRepository = defaultRepo) {}

  getRepository(): IShippingCompaniesRepository {
    return this.repo;
  }

  async list(): Promise<Record<string, any>[]> {
    return this.repo.list();
  }

  async findById(id: number | string): Promise<Record<string, any> | null> {
    return this.repo.findById(id);
  }

  async create(data: CreateShippingCompanyDTO): Promise<Record<string, any>> {
    return this.repo.create(data);
  }

  async update(
    id: number | string,
    data: UpdateShippingCompanyDTO
  ): Promise<Record<string, any> | null> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return null;
    }
    return this.repo.update(id, data);
  }

  async delete(id: number | string): Promise<boolean> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return false;
    }
    return this.repo.delete(id);
  }
}

export const shippingCompaniesService = new ShippingCompaniesService();
