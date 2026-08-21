import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { AuditLogEntry, AuditLogFilters } from './types';

export interface IAuditLogRepository {
  findLogs(
    filters: AuditLogFilters,
    queryable?: Queryable
  ): Promise<{ rows: AuditLogEntry[]; total: number }>;
  findDistinctActions(queryable?: Queryable): Promise<string[]>;
}

export class AuditLogRepository implements IAuditLogRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findLogs(
    filters: AuditLogFilters,
    queryable?: Queryable
  ): Promise<{ rows: AuditLogEntry[]; total: number }> {
    const {
      userId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    const offset = (page - 1) * limit;
    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (userId) {
      where.push(`user_id = $${paramIdx++}`);
      params.push(Number(userId));
    }
    if (action) {
      where.push(`action = $${paramIdx++}`);
      params.push(String(action));
    }
    if (entityType) {
      where.push(`entity_type = $${paramIdx++}`);
      params.push(String(entityType));
    }
    if (entityId) {
      where.push(`entity_id = $${paramIdx++}`);
      params.push(String(entityId));
    }
    if (startDate) {
      where.push(`created_at >= $${paramIdx++}`);
      params.push(String(startDate));
    }
    if (endDate) {
      where.push(`created_at <= $${paramIdx++}`);
      params.push(String(endDate));
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.count || 0);

    const queryParams = [...params, limit, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const result = await this.q(queryable).query<AuditLogEntry>(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    const rows = result.rows.map((row: any) => ({
      ...row,
      details:
        row.details && typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    }));

    return { rows, total };
  }

  async findDistinctActions(queryable?: Queryable): Promise<string[]> {
    const result = await this.q(queryable).query<{ action: string }>(
      'SELECT DISTINCT action FROM audit_logs ORDER BY action'
    );
    return result.rows.map((r) => r.action);
  }
}

export const auditLogRepository = new AuditLogRepository();
