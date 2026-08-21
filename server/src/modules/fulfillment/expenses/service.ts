import { IExpensesRepository, expensesRepository as defaultRepo } from './repository';
import {
  CreateExpenseDTO,
  UpdateExpenseDTO,
  ExpenseFilters,
  ExpenseListResult,
  PnlResult,
} from './types';

export class ExpensesService {
  constructor(private repo: IExpensesRepository = defaultRepo) {}

  getRepository(): IExpensesRepository {
    return this.repo;
  }

  async list(filters: ExpenseFilters): Promise<ExpenseListResult> {
    return this.repo.list(filters);
  }

  async findById(id: number | string): Promise<Record<string, any> | null> {
    return this.repo.findById(id);
  }

  async create(data: CreateExpenseDTO, userId: number): Promise<Record<string, any>> {
    return this.repo.create(data, userId);
  }

  async update(
    id: number | string,
    data: UpdateExpenseDTO
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

  async getPnl(from?: string, to?: string): Promise<PnlResult> {
    const dateFrom =
      from ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0];

    return this.repo.getPnl(dateFrom, dateTo);
  }
}

export const expensesService = new ExpensesService();
