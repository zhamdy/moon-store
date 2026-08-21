import { withTransaction } from '../../../database/transaction';
import { IBranchesRepository, branchesRepository as defaultRepo } from './repository';
import {
  Branch,
  ConsolidatedBranch,
  BranchTransfer,
  CreateBranchDTO,
  UpdateBranchDTO,
  CreateTransferDTO,
  TransferFilters,
} from './types';

export class BranchesService {
  constructor(private repo: IBranchesRepository = defaultRepo) {}

  async list(): Promise<Branch[]> {
    return this.repo.findAllWithInventory();
  }

  async create(data: CreateBranchDTO): Promise<Branch> {
    return withTransaction(async (client) => {
      if (data.is_main) {
        await this.repo.resetMainBranch(undefined, client);
      }
      return this.repo.create(data, client);
    });
  }

  async update(id: number, data: UpdateBranchDTO): Promise<Branch> {
    return withTransaction(async (client) => {
      const existing = await this.repo.findById(id, client);
      if (!existing) {
        const err = new Error('Branch not found');
        (err as any).statusCode = 404;
        throw err;
      }

      if (data.is_main) {
        await this.repo.resetMainBranch(id, client);
      }

      const updated = await this.repo.update(id, data, client);
      if (!updated) {
        const err = new Error('Branch not found');
        (err as any).statusCode = 404;
        throw err;
      }
      return updated;
    });
  }

  async getConsolidated(): Promise<ConsolidatedBranch[]> {
    return this.repo.getConsolidatedBranches();
  }

  async listTransfers(filters: TransferFilters): Promise<BranchTransfer[]> {
    return this.repo.findTransfers(filters);
  }

  async createTransfer(data: CreateTransferDTO, createdBy: number): Promise<BranchTransfer> {
    if (data.source_branch_id === data.target_branch_id) {
      const err = new Error('Source and target branch must be different');
      (err as any).statusCode = 400;
      throw err;
    }
    return this.repo.createTransfer(data, createdBy);
  }

  async updateTransferStatus(id: number, status: string): Promise<{ id: number; status: string }> {
    if (!['in_transit', 'completed', 'cancelled'].includes(status)) {
      const err = new Error('Invalid status');
      (err as any).statusCode = 400;
      throw err;
    }

    const transfer = await this.repo.findTransferById(id);
    if (!transfer) {
      const err = new Error('Transfer not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (status === 'completed' && transfer.status !== 'completed') {
      await withTransaction(async (client) => {
        await this.repo.completeTransfer(transfer, status, client);
      });
    } else {
      await this.repo.updateTransferStatus(id, status);
    }

    return { id, status };
  }
}

export const branchesService = new BranchesService();
