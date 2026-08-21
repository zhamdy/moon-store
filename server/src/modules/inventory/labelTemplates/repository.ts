import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  LabelTemplateRecord,
  CreateLabelTemplateDTO,
  UpdateLabelTemplateDTO,
} from './types';

export interface ILabelTemplatesRepository {
  findAll(queryable?: Queryable): Promise<LabelTemplateRecord[]>;
  findById(id: number | string, queryable?: Queryable): Promise<LabelTemplateRecord | null>;
  clearDefault(excludeId?: number | string, queryable?: Queryable): Promise<void>;
  create(data: CreateLabelTemplateDTO, queryable?: Queryable): Promise<LabelTemplateRecord>;
  update(
    id: number | string,
    data: UpdateLabelTemplateDTO,
    queryable?: Queryable
  ): Promise<LabelTemplateRecord | null>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class LabelTemplatesRepository implements ILabelTemplatesRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findAll(queryable?: Queryable): Promise<LabelTemplateRecord[]> {
    const res = await this.q(queryable).query<LabelTemplateRecord>(
      'SELECT * FROM label_templates ORDER BY is_default DESC, name ASC'
    );
    return res.rows;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<LabelTemplateRecord | null> {
    const res = await this.q(queryable).query<LabelTemplateRecord>(
      'SELECT * FROM label_templates WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async clearDefault(excludeId?: number | string, queryable?: Queryable): Promise<void> {
    if (excludeId !== undefined) {
      await this.q(queryable).query(
        'UPDATE label_templates SET is_default = 0 WHERE id != $1',
        [excludeId]
      );
    } else {
      await this.q(queryable).query('UPDATE label_templates SET is_default = 0');
    }
  }

  async create(data: CreateLabelTemplateDTO, queryable?: Queryable): Promise<LabelTemplateRecord> {
    const res = await this.q(queryable).query<LabelTemplateRecord>(
      `INSERT INTO label_templates (name, width_mm, height_mm, layout_json, is_default)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        data.name,
        data.width_mm,
        data.height_mm,
        data.layout_json,
        data.is_default ? 1 : 0,
      ]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateLabelTemplateDTO,
    queryable?: Queryable
  ): Promise<LabelTemplateRecord | null> {
    const res = await this.q(queryable).query<LabelTemplateRecord>(
      `UPDATE label_templates SET name = $1, width_mm = $2, height_mm = $3, layout_json = $4, is_default = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        data.name,
        data.width_mm,
        data.height_mm,
        data.layout_json,
        data.is_default ? 1 : 0,
        id,
      ]
    );
    return res.rows[0] || null;
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM label_templates WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows.length > 0;
  }
}

export const labelTemplatesRepository = new LabelTemplatesRepository();
