import { withTransaction } from '../../../database/transaction';
import { IStorefrontRepository, storefrontRepository as defaultRepo } from './repository';
import { BannerDTO, BannerRecord, StorefrontConfigMap } from './types';

export class StorefrontService {
  constructor(private repo: IStorefrontRepository = defaultRepo) {}

  getRepository(): IStorefrontRepository {
    return this.repo;
  }

  async getActiveBanners(): Promise<BannerRecord[]> {
    return this.repo.getActiveBanners();
  }

  async getAllBanners(): Promise<BannerRecord[]> {
    return this.repo.getAllBanners();
  }

  async findById(id: number | string): Promise<BannerRecord | null> {
    return this.repo.findById(id);
  }

  async createBanner(data: BannerDTO): Promise<BannerRecord> {
    return this.repo.createBanner(data);
  }

  async updateBanner(id: number | string, data: BannerDTO): Promise<BannerRecord | null> {
    return this.repo.updateBanner(id, data);
  }

  async deleteBanner(id: number | string): Promise<boolean> {
    return this.repo.deleteBanner(id);
  }

  async getConfig(): Promise<StorefrontConfigMap> {
    return this.repo.getConfig();
  }

  /** A merge, exactly like the global settings write: keys absent from `data` keep their stored value. */
  async updateConfig(data: Partial<StorefrontConfigMap>): Promise<StorefrontConfigMap> {
    await withTransaction(async (client) => {
      await this.repo.upsertConfig(data, client);
    });
    return this.repo.getConfig();
  }
}

export const storefrontService = new StorefrontService();
