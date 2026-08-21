import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { BannerDTO, BannerRecord } from './types';

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
}

export const storefrontRepository = new StorefrontRepository();
