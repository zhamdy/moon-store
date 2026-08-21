import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { SettingsMap } from './types';

export interface ISettingsRepository {
  getAll(queryable?: Queryable): Promise<SettingsMap>;
  upsertMany(settings: SettingsMap, queryable?: Queryable): Promise<void>;
}

export class SettingsRepository implements ISettingsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async getAll(queryable?: Queryable): Promise<SettingsMap> {
    const result = await this.q(queryable).query<{ key: string; value: string }>(
      'SELECT key, value FROM settings'
    );
    const settings: SettingsMap = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  async upsertMany(settings: SettingsMap, queryable?: Queryable): Promise<void> {
    const client = this.q(queryable);
    for (const [key, value] of Object.entries(settings)) {
      await client.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value]
      );
    }
  }
}

export const settingsRepository = new SettingsRepository();
