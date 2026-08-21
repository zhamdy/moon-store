import { IExpensesRepository, expensesRepository as defaultRepo } from './repository';
import { ExpenseFilters, CreateExpenseDTO, PnLStatement } from './types';

export class ExpensesService {
  constructor(private repo: IExpensesRepository = defaultRepo) {}

  getRepository(): IExpensesRepository {
    return this.repo;
  }

  list(filters: ExpenseFilters) {
    return this.repo.list(filters);
  }

  findById(id: number | string) {
    return this.repo.findById(id);
  }

  create(data: CreateExpenseDTO, userId: number) {
    return this.repo.create(data, userId);
  }

  update(id: number | string, data: CreateExpenseDTO) {
    return this.repo.update(id, data);
  }

  delete(id: number | string) {
    return this.repo.delete(id);
  }

  getPnL(from: string, to: string): Promise<PnLStatement> {
    return this.repo.getPnL(from, to);
  }
}

export const expensesService = new ExpensesService();
