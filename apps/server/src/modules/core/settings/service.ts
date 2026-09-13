import { withTransaction } from '../../../database/transaction';
import { ISettingsRepository, settingsRepository as defaultRepo } from './repository';
import { SettingsMap, UpdateSettingsDTO } from './types';

export class SettingsService {
  constructor(private repo: ISettingsRepository = defaultRepo) {}

  async getAll(): Promise<SettingsMap> {
    return this.repo.getAll();
  }

  async update(settings: UpdateSettingsDTO): Promise<SettingsMap> {
    await withTransaction(async (client) => {
      await this.repo.upsertMany(settings, client);
    });
    return this.repo.getAll();
  }
}

export const settingsService = new SettingsService();
