import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { NotificationRecord } from './types';

export interface INotificationsRepository {
  list(
    userId: number,
    unreadOnly: boolean,
    page: number,
    pageSize: number,
    queryable?: Queryable
  ): Promise<{ rows: NotificationRecord[]; total: number }>;
  getUnreadCount(userId: number, queryable?: Queryable): Promise<number>;
  markAsRead(id: number | string, userId: number, queryable?: Queryable): Promise<void>;
  markAllAsRead(userId: number, queryable?: Queryable): Promise<void>;
  create(
    userId: number,
    type: string,
    title: string,
    message: string | null,
    entityType: string | null,
    entityId: string | null,
    link: string | null,
    queryable?: Queryable
  ): Promise<void>;
  getAdminIds(queryable?: Queryable): Promise<number[]>;
}

export class NotificationsRepository implements INotificationsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    userId: number,
    unreadOnly: boolean,
    page: number,
    pageSize: number,
    queryable?: Queryable
  ): Promise<{ rows: NotificationRecord[]; total: number }> {
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params: unknown[] = [userId];

    if (unreadOnly) {
      query += ' AND read = 0';
    }

    const count = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COUNT(*) AS total FROM notifications WHERE user_id = $1${unreadOnly ? ' AND read = 0' : ''}`,
      [userId]
    );
    params.push(pageSize, (page - 1) * pageSize);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await this.q(queryable).query<NotificationRecord>(query, params);
    return { rows: result.rows, total: Number(count.rows[0]?.total || 0) };
  }

  async getUnreadCount(userId: number, queryable?: Queryable): Promise<number> {
    const result = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = 0`,
      [userId]
    );
    return Number(result.rows[0]?.count || 0);
  }

  async markAsRead(id: number | string, userId: number, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query(
      `UPDATE notifications SET read = 1 WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  }

  async markAllAsRead(userId: number, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query(
      `UPDATE notifications SET read = 1 WHERE user_id = $1 AND read = 0`,
      [userId]
    );
  }

  async create(
    userId: number,
    type: string,
    title: string,
    message: string | null,
    entityType: string | null,
    entityId: string | null,
    link: string | null,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, link)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, type, title, message, entityType, entityId, link]
    );
  }

  async getAdminIds(queryable?: Queryable): Promise<number[]> {
    const result = await this.q(queryable).query<{ id: number }>(
      `SELECT id FROM users WHERE role = 'Admin'`
    );
    return result.rows.map((r) => r.id);
  }
}

export const notificationsRepository = new NotificationsRepository();
