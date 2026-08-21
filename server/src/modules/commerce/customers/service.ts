import { withTransaction } from '../../../database/transaction';
import { ICustomersRepository, customersRepository as defaultRepo } from './repository';
import { CreateCustomerDTO, UpdateCustomerDTO, CustomerFilters } from './types';

export class CustomersService {
  constructor(private repo: ICustomersRepository = defaultRepo) {}

  getRepository(): ICustomersRepository {
    return this.repo;
  }

  list(filters: CustomerFilters) {
    return this.repo.list(filters);
  }

  findById(id: number | string) {
    return this.repo.findById(id);
  }

  create(data: CreateCustomerDTO) {
    return this.repo.create(data);
  }

  update(id: number | string, data: UpdateCustomerDTO) {
    return this.repo.update(id, data);
  }

  delete(id: number | string) {
    return this.repo.delete(id);
  }

  getStats(id: number | string) {
    return this.repo.getStats(id);
  }

  getSales(id: number | string, page: number, limit: number) {
    return this.repo.getSales(id, page, limit);
  }

  getLoyaltyHistory(id: number | string) {
    return this.repo.getLoyaltyHistory(id);
  }

  adjustLoyalty(id: number, points: number, note: string) {
    return withTransaction((client) => this.repo.adjustLoyalty(id, points, note, client));
  }
}

export const customersService = new CustomersService();
