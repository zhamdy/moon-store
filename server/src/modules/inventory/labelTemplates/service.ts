import { withTransaction } from '../../../database/transaction';
import {
  ILabelTemplatesRepository,
  labelTemplatesRepository as defaultRepo,
} from './repository';
import {
  CreateLabelTemplateDTO,
  UpdateLabelTemplateDTO,
  LabelTemplateRecord,
} from './types';

export class LabelTemplatesService {
  constructor(private repo: ILabelTemplatesRepository = defaultRepo) {}

  getRepository(): ILabelTemplatesRepository {
    return this.repo;
  }

  findAll(): Promise<LabelTemplateRecord[]> {
    return this.repo.findAll();
  }

  findById(id: number | string): Promise<LabelTemplateRecord | null> {
    return this.repo.findById(id);
  }

  async create(data: CreateLabelTemplateDTO): Promise<LabelTemplateRecord> {
    return withTransaction(async (client) => {
      if (data.is_default) {
        await this.repo.clearDefault(undefined, client);
      }
      return this.repo.create(data, client);
    });
  }

  async update(
    id: number | string,
    data: UpdateLabelTemplateDTO
  ): Promise<{ success: boolean; data?: LabelTemplateRecord; error?: string }> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return { success: false, error: 'Template not found' };
    }

    const updated = await withTransaction(async (client) => {
      if (data.is_default) {
        await this.repo.clearDefault(id, client);
      }
      return this.repo.update(id, data, client);
    });

    return { success: true, data: updated! };
  }

  async delete(id: number | string): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return { success: false, error: 'Template not found' };
    }

    await this.repo.delete(id);
    return { success: true };
  }
}

export const labelTemplatesService = new LabelTemplatesService();
