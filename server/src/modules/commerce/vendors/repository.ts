import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  CreateVendorPayoutDTO,
  VendorDTO,
  VendorFilters,
  VendorPayoutRecord,
  VendorRecord,
  VendorPayoutFilters,
} from './types';

export interface IVendorsRepository {
  list(
    filters: VendorFilters,
    queryable?: Queryable
  ): Promise<{ rows: VendorRecord[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<VendorRecord | null>;
  create(data: VendorDTO, queryable?: Queryable): Promise<VendorRecord>;
  update(id: number | string, data: VendorDTO, queryable?: Queryable): Promise<VendorRecord | null>;
  getPayouts(
    vendorId: number | string,
    filters: VendorPayoutFilters,
    queryable?: Queryable
  ): Promise<{ rows: VendorPayoutRecord[]; total: number }>;
  createPayout(
    vendorId: number | string,
    data: CreateVendorPayoutDTO,
    createdBy: number,
    queryable?: Queryable
  ): Promise<VendorPayoutRecord>;
}

export class VendorsRepository implements IVendorsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: VendorFilters,
    queryable?: Queryable
  ): Promise<{ rows: VendorRecord[]; total: number }> {
    const { status, page: pageNum, pageSize: limitNum, search, sortBy, sortOrder } = filters;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumn = sortBy === 'createdAt' ? 'v.created_at' : 'v.name';
    const offset = (pageNum - 1) * limitNum;
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (status) {
      params.push(status);
      where += ` AND v.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (v.name ILIKE $${params.length} OR v.contact_person ILIKE $${params.length} OR v.phone ILIKE $${params.length})`;
    }

    const countResult = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COUNT(*)::int as total FROM vendors v ${where}`,
      params
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const vendors = await this.q(queryable).query<VendorRecord>(
      `SELECT v.id, v.name, v.contact_person, v.email, v.phone, v.address, v.tax_number, v.commission_rate, v.status, v.created_at, v.updated_at,
              COUNT(p.id)::int as product_count
       FROM vendors v
       LEFT JOIN products p ON p.distributor_id = v.id
       ${where}
       GROUP BY v.id, v.name, v.contact_person, v.email, v.phone, v.address, v.tax_number, v.commission_rate, v.status, v.created_at, v.updated_at
       ORDER BY ${sortColumn} ${direction}, v.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limitNum, offset]
    );

    return { rows: vendors.rows, total };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<VendorRecord | null> {
    const res = await this.q(queryable).query<VendorRecord>('SELECT * FROM vendors WHERE id = $1', [
      id,
    ]);
    return res.rows[0] || null;
  }

  async create(data: VendorDTO, queryable?: Queryable): Promise<VendorRecord> {
    const result = await this.q(queryable).query<VendorRecord>(
      `INSERT INTO vendors (name, contact_person, email, phone, address, tax_number, commission_rate, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        data.name,
        data.contact_person || null,
        data.email || null,
        data.phone || null,
        data.address || null,
        data.tax_number || null,
        data.commission_rate ?? 0,
        data.status || 'active',
      ]
    );
    return result.rows[0];
  }

  async update(
    id: number | string,
    data: VendorDTO,
    queryable?: Queryable
  ): Promise<VendorRecord | null> {
    const result = await this.q(queryable).query<VendorRecord>(
      `UPDATE vendors SET name = $1, contact_person = $2, email = $3, phone = $4, address = $5,
              tax_number = $6, commission_rate = $7, status = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [
        data.name,
        data.contact_person || null,
        data.email || null,
        data.phone || null,
        data.address || null,
        data.tax_number || null,
        data.commission_rate ?? 0,
        data.status || 'active',
        id,
      ]
    );
    return result.rows[0] || null;
  }

  async getPayouts(
    vendorId: number | string,
    filters: VendorPayoutFilters,
    queryable?: Queryable
  ): Promise<{ rows: VendorPayoutRecord[]; total: number }> {
    const count = await this.q(queryable).query<{ total: string | number }>(
      'SELECT COUNT(*) AS total FROM vendor_payouts WHERE vendor_id = $1',
      [vendorId]
    );
    const payouts = await this.q(queryable).query<VendorPayoutRecord>(
      `SELECT vp.*, u.name as created_by_name
       FROM vendor_payouts vp
       JOIN users u ON vp.created_by = u.id
       WHERE vp.vendor_id = $1
       ORDER BY vp.created_at ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}, vp.id ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}
       LIMIT $2 OFFSET $3`,
      [vendorId, filters.pageSize, (filters.page - 1) * filters.pageSize]
    );
    return { rows: payouts.rows, total: Number(count.rows[0]?.total || 0) };
  }

  async createPayout(
    vendorId: number | string,
    data: CreateVendorPayoutDTO,
    createdBy: number,
    queryable?: Queryable
  ): Promise<VendorPayoutRecord> {
    const result = await this.q(queryable).query<VendorPayoutRecord>(
      `INSERT INTO vendor_payouts (vendor_id, amount, period_start, period_end, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        vendorId,
        data.amount,
        data.period_start || null,
        data.period_end || null,
        data.notes || null,
        createdBy,
      ]
    );
    return result.rows[0];
  }
}

export const vendorsRepository = new VendorsRepository();
