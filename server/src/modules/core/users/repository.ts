import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { UserListItem, DeliveryUser, UserDbRecord } from './types';

export interface IUsersRepository {
  findAll(queryable?: Queryable): Promise<UserListItem[]>;
  findDeliveryUsers(queryable?: Queryable): Promise<DeliveryUser[]>;
  findById(id: number | string, queryable?: Queryable): Promise<UserDbRecord | null>;
  create(
    data: { name: string; email: string; password_hash: string; role: string },
    queryable?: Queryable
  ): Promise<UserListItem>;
  update(
    id: number | string,
    data: { name: string; email: string; password_hash: string; role: string },
    queryable?: Queryable
  ): Promise<UserListItem | null>;
  getFavorites(userId: number, queryable?: Queryable): Promise<any[]>;
  updateFavorites(userId: number, favorites: any[], queryable?: Queryable): Promise<void>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class UsersRepository implements IUsersRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findAll(queryable?: Queryable): Promise<UserListItem[]> {
    const result = await this.q(queryable).query<UserListItem>(
      'SELECT id, name, email, role, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async findDeliveryUsers(queryable?: Queryable): Promise<DeliveryUser[]> {
    const result = await this.q(queryable).query<DeliveryUser>(
      "SELECT id, name, email FROM users WHERE role = 'Delivery' ORDER BY name"
    );
    return result.rows;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<UserDbRecord | null> {
    const result = await this.q(queryable).query<UserDbRecord>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(
    data: { name: string; email: string; password_hash: string; role: string },
    queryable?: Queryable
  ): Promise<UserListItem> {
    const result = await this.q(queryable).query<UserListItem>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [data.name, data.email, data.password_hash, data.role]
    );
    return result.rows[0];
  }

  async update(
    id: number | string,
    data: { name: string; email: string; password_hash: string; role: string },
    queryable?: Queryable
  ): Promise<UserListItem | null> {
    const result = await this.q(queryable).query<UserListItem>(
      `UPDATE users SET name = $1, email = $2, password_hash = $3, role = $4 WHERE id = $5
       RETURNING id, name, email, role, created_at, last_login`,
      [data.name, data.email, data.password_hash, data.role, id]
    );
    return result.rows[0] || null;
  }

  async getFavorites(userId: number, queryable?: Queryable): Promise<any[]> {
    const result = await this.q(queryable).query<{ favorites: any }>(
      'SELECT favorites FROM users WHERE id = $1',
      [userId]
    );
    const rawFav = result.rows[0]?.favorites;
    if (typeof rawFav === 'string') {
      try {
        return JSON.parse(rawFav);
      } catch {
        return [];
      }
    }
    return rawFav || [];
  }

  async updateFavorites(userId: number, favorites: any[], queryable?: Queryable): Promise<void> {
    await this.q(queryable).query('UPDATE users SET favorites = $1 WHERE id = $2', [
      JSON.stringify(favorites),
      userId,
    ]);
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const result = await this.q(queryable).query<{ id: number }>(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }
}

export const usersRepository = new UsersRepository();
