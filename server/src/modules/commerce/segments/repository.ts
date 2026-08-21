import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { CreateSegmentDTO, SegmentRecord, UpdateSegmentDTO } from './types';

export interface ISegmentsRepository {
  list(queryable?: Queryable): Promise<SegmentRecord[]>;
  findById(id: number | string, queryable?: Queryable): Promise<SegmentRecord | null>;
  create(data: CreateSegmentDTO, queryable?: Queryable): Promise<SegmentRecord>;
  update(
    id: number | string,
    data: UpdateSegmentDTO,
    queryable?: Queryable
  ): Promise<SegmentRecord | null>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class SegmentsRepository implements ISegmentsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(queryable?: Queryable): Promise<SegmentRecord[]> {
    const segments = await this.q(queryable).query<SegmentRecord>(
      `SELECT s.*,
        (SELECT COUNT(*)::int FROM customer_segment_members WHERE segment_id = s.id) as member_count
       FROM customer_segments s
       ORDER BY s.name ASC`
    );
    return segments.rows;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<SegmentRecord | null> {
    const res = await this.q(queryable).query<SegmentRecord>(
      `SELECT s.*,
        (SELECT COUNT(*)::int FROM customer_segment_members WHERE segment_id = s.id) as member_count
       FROM customer_segments s
       WHERE s.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async create(data: CreateSegmentDTO, queryable?: Queryable): Promise<SegmentRecord> {
    const result = await this.q(queryable).query<SegmentRecord>(
      `INSERT INTO customer_segments (name, description, rules_json)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.name, data.description || null, data.rules_json]
    );
    return result.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateSegmentDTO,
    queryable?: Queryable
  ): Promise<SegmentRecord | null> {
    const result = await this.q(queryable).query<SegmentRecord>(
      `UPDATE customer_segments SET name = $1, description = $2, rules_json = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [data.name, data.description || null, data.rules_json, id]
    );
    return result.rows[0] || null;
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const result = await this.q(queryable).query(
      'DELETE FROM customer_segments WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }
}

export const segmentsRepository = new SegmentsRepository();
