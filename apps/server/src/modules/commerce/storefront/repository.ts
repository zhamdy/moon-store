import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { BannerDTO, BannerRecord, StorefrontConfigMap } from './types';

/**
 * The storefront config is stored in the generic `settings` key/value table, under this
 * prefix, rather than a table of its own. Two reasons: it is the same shape settings
 * already are (a flat string map with a growing key set), and the plain field names the
 * client uses -- `store_name`, in particular -- collide with settings the till already
 * reads for its own purposes (seed.ts writes a `store_name` for the business itself). The
 * prefix keeps the two namespaces from ever writing over each other.
 */
const CONFIG_KEY_PREFIX = 'storefront_config_';

export interface IStorefrontRepository {
  getActiveBanners(queryable?: Queryable): Promise<BannerRecord[]>;
  getAllBanners(queryable?: Queryable): Promise<BannerRecord[]>;
  findById(id: number | string, queryable?: Queryable): Promise<BannerRecord | null>;
  createBanner(data: BannerDTO, queryable?: Queryable): Promise<BannerRecord>;
  updateBanner(
    id: number | string,
    data: BannerDTO,
    queryable?: Queryable
  ): Promise<BannerRecord | null>;
  deleteBanner(id: number | string, queryable?: Queryable): Promise<boolean>;
  getConfig(queryable?: Queryable): Promise<StorefrontConfigMap>;
  upsertConfig(data: Partial<StorefrontConfigMap>, queryable?: Queryable): Promise<void>;
}

export class StorefrontRepository implements IStorefrontRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async getActiveBanners(queryable?: Queryable): Promise<BannerRecord[]> {
    const banners = await this.q(queryable).query<BannerRecord>(
      `SELECT * FROM storefront_banners WHERE is_active = 1 ORDER BY position ASC, created_at DESC`
    );
    return banners.rows;
  }

  async getAllBanners(queryable?: Queryable): Promise<BannerRecord[]> {
    const banners = await this.q(queryable).query<BannerRecord>(
      `SELECT * FROM storefront_banners ORDER BY position ASC, created_at DESC`
    );
    return banners.rows;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<BannerRecord | null> {
    const res = await this.q(queryable).query<BannerRecord>(
      'SELECT * FROM storefront_banners WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async createBanner(data: BannerDTO, queryable?: Queryable): Promise<BannerRecord> {
    const result = await this.q(queryable).query<BannerRecord>(
      `INSERT INTO storefront_banners (title, subtitle, image_url, link_url, position, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.title,
        data.subtitle || null,
        data.image_url,
        data.link_url || null,
        data.position ?? 0,
        data.is_active !== false ? 1 : 0,
      ]
    );
    return result.rows[0];
  }

  async updateBanner(
    id: number | string,
    data: BannerDTO,
    queryable?: Queryable
  ): Promise<BannerRecord | null> {
    const result = await this.q(queryable).query<BannerRecord>(
      `UPDATE storefront_banners SET title = $1, subtitle = $2, image_url = $3, link_url = $4, position = $5, is_active = $6
       WHERE id = $7 RETURNING *`,
      [
        data.title,
        data.subtitle || null,
        data.image_url,
        data.link_url || null,
        data.position ?? 0,
        data.is_active !== false ? 1 : 0,
        id,
      ]
    );
    return result.rows[0] || null;
  }

  async deleteBanner(id: number | string, queryable?: Queryable): Promise<boolean> {
    const result = await this.q(queryable).query(
      'DELETE FROM storefront_banners WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  async getConfig(queryable?: Queryable): Promise<StorefrontConfigMap> {
    const result = await this.q(queryable).query<{ key: string; value: string }>(
      'SELECT key, value FROM settings WHERE key LIKE $1',
      [`${CONFIG_KEY_PREFIX}%`]
    );
    const config: StorefrontConfigMap = {};
    for (const row of result.rows) {
      config[row.key.slice(CONFIG_KEY_PREFIX.length)] = row.value;
    }
    return config;
  }

  async upsertConfig(data: Partial<StorefrontConfigMap>, queryable?: Queryable): Promise<void> {
    const client = this.q(queryable);
    for (const [field, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await client.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [`${CONFIG_KEY_PREFIX}${field}`, value]
      );
    }
  }
}

export const storefrontRepository = new StorefrontRepository();
