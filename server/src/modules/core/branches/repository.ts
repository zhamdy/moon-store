import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  Branch,
  ConsolidatedBranch,
  BranchTransfer,
  CreateBranchDTO,
  UpdateBranchDTO,
  CreateTransferDTO,
  TransferFilters,
} from './types';

export interface IBranchesRepository {
  findAllWithInventory(queryable?: Queryable): Promise<Branch[]>;
  findById(id: number, queryable?: Queryable): Promise<Branch | null>;
  resetMainBranch(excludeId?: number, queryable?: Queryable): Promise<void>;
  create(data: CreateBranchDTO, queryable?: Queryable): Promise<Branch>;
  update(id: number, data: UpdateBranchDTO, queryable?: Queryable): Promise<Branch | null>;
  getConsolidatedBranches(queryable?: Queryable): Promise<ConsolidatedBranch[]>;
  findTransfers(
    filters: TransferFilters,
    queryable?: Queryable
  ): Promise<{ rows: BranchTransfer[]; total: number }>;
  findTransferById(id: number, queryable?: Queryable): Promise<BranchTransfer | null>;
  createTransfer(
    data: CreateTransferDTO,
    createdBy: number,
    queryable?: Queryable
  ): Promise<BranchTransfer>;
  updateTransferStatus(id: number, status: string, queryable?: Queryable): Promise<void>;
  completeTransfer(transfer: BranchTransfer, status: string, queryable: Queryable): Promise<void>;
}

export class BranchesRepository implements IBranchesRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findAllWithInventory(queryable?: Queryable): Promise<Branch[]> {
    const result = await this.q(queryable).query<Branch>(
      `SELECT b.*,
       (SELECT COUNT(*)::int FROM branch_inventory WHERE branch_id = b.id) as product_count,
       (SELECT COALESCE(SUM(stock), 0)::int FROM branch_inventory WHERE branch_id = b.id) as total_stock
       FROM branches b ORDER BY b.is_main DESC, b.name ASC`
    );
    return result.rows;
  }

  async findById(id: number, queryable?: Queryable): Promise<Branch | null> {
    const result = await this.q(queryable).query<Branch>('SELECT * FROM branches WHERE id = $1', [
      id,
    ]);
    return result.rows[0] || null;
  }

  async resetMainBranch(excludeId?: number, queryable?: Queryable): Promise<void> {
    if (excludeId !== undefined) {
      await this.q(queryable).query(
        'UPDATE branches SET is_main = 0 WHERE id != $1 AND is_main = 1',
        [excludeId]
      );
    } else {
      await this.q(queryable).query('UPDATE branches SET is_main = 0 WHERE is_main = 1');
    }
  }

  async create(data: CreateBranchDTO, queryable?: Queryable): Promise<Branch> {
    const isMain = data.is_main ? 1 : 0;
    const result = await this.q(queryable).query<Branch>(
      `INSERT INTO branches (name, code, address, phone, is_main)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.code, data.address || null, data.phone || null, isMain]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateBranchDTO, queryable?: Queryable): Promise<Branch | null> {
    const isMain = data.is_main ? 1 : 0;
    const result = await this.q(queryable).query<Branch>(
      `UPDATE branches SET name = $1, code = $2, address = $3, phone = $4, is_main = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [data.name, data.code, data.address || null, data.phone || null, isMain, id]
    );
    return result.rows[0] || null;
  }

  async getConsolidatedBranches(queryable?: Queryable): Promise<ConsolidatedBranch[]> {
    const branches = await this.q(queryable).query<{
      id: number;
      name: string;
      code: string;
      is_main: number | boolean;
    }>('SELECT id, name, code, is_main FROM branches ORDER BY name');

    const data: ConsolidatedBranch[] = await Promise.all(
      branches.rows.map(async (b) => {
        const stats = await this.q(queryable).query<{
          products: number;
          stock: number;
        }>(
          `SELECT
            (SELECT COUNT(*)::int FROM branch_inventory WHERE branch_id = $1) as products,
            (SELECT COALESCE(SUM(stock), 0)::int FROM branch_inventory WHERE branch_id = $1) as stock`,
          [b.id]
        );
        return {
          ...b,
          stats: stats.rows[0],
        };
      })
    );

    return data;
  }

  async findTransfers(
    filters: TransferFilters,
    queryable?: Queryable
  ): Promise<{ rows: BranchTransfer[]; total: number }> {
    const { status, page, pageSize, sortBy, sortOrder } = filters;
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [];
    let where = '';

    if (status && status !== 'all') {
      params.push(status);
      where = `WHERE t.status = $${params.length}`;
    }

    const count = await this.q(queryable).query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM branch_transfers t ${where}`,
      params
    );
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const sortColumn = sortBy === 'status' ? 't.status' : 't.created_at';

    const result = await this.q(queryable).query<BranchTransfer>(
      `SELECT t.*, sb.name as source_branch, tb.name as target_branch,
              p.name as product_name, p.sku as product_sku,
              u.name as created_by_name
       FROM branch_transfers t
       JOIN branches sb ON t.source_branch_id = sb.id
       JOIN branches tb ON t.target_branch_id = tb.id
       JOIN products p ON t.product_id = p.id
       LEFT JOIN users u ON t.created_by = u.id
       ${where}
       ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}, t.id ${sortOrder.toUpperCase()}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, offset]
    );

    return { rows: result.rows, total: count.rows[0]?.total ?? 0 };
  }

  async findTransferById(id: number, queryable?: Queryable): Promise<BranchTransfer | null> {
    const result = await this.q(queryable).query<BranchTransfer>(
      'SELECT * FROM branch_transfers WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async createTransfer(
    data: CreateTransferDTO,
    createdBy: number,
    queryable?: Queryable
  ): Promise<BranchTransfer> {
    const result = await this.q(queryable).query<BranchTransfer>(
      `INSERT INTO branch_transfers (source_branch_id, target_branch_id, product_id, variant_id, quantity, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.source_branch_id,
        data.target_branch_id,
        data.product_id,
        data.variant_id || null,
        data.quantity,
        data.notes || null,
        createdBy,
      ]
    );
    return result.rows[0];
  }

  async updateTransferStatus(id: number, status: string, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query('UPDATE branch_transfers SET status = $1 WHERE id = $2', [
      status,
      id,
    ]);
  }

  async completeTransfer(
    transfer: BranchTransfer,
    status: string,
    queryable: Queryable
  ): Promise<void> {
    // Decrement source branch inventory
    await queryable.query(
      `INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT(branch_id, product_id, COALESCE(variant_id, 0)) DO NOTHING`,
      [transfer.source_branch_id, transfer.product_id, transfer.variant_id || null]
    );
    await queryable.query(
      `UPDATE branch_inventory SET stock = GREATEST(0, stock - $1), updated_at = NOW()
       WHERE branch_id = $2 AND product_id = $3`,
      [transfer.quantity, transfer.source_branch_id, transfer.product_id]
    );

    // Increment target branch inventory
    await queryable.query(
      `INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(branch_id, product_id, COALESCE(variant_id, 0))
       DO UPDATE SET stock = branch_inventory.stock + $4, updated_at = NOW()`,
      [
        transfer.target_branch_id,
        transfer.product_id,
        transfer.variant_id || null,
        transfer.quantity,
      ]
    );

    // Update transfer record
    await queryable.query(
      'UPDATE branch_transfers SET status = $1, completed_at = NOW() WHERE id = $2',
      [status, transfer.id]
    );
  }
}

export const branchesRepository = new BranchesRepository();
