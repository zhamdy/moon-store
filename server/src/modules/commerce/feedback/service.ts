import { IFeedbackRepository, feedbackRepository as defaultRepo } from './repository';
import {
  CreateFeedbackDTO,
  FeedbackFilters,
  FeedbackListResult,
  FeedbackRecord,
  FeedbackStats,
} from './types';

export class FeedbackService {
  constructor(private repo: IFeedbackRepository = defaultRepo) {}

  getRepository(): IFeedbackRepository {
    return this.repo;
  }

  async create(data: CreateFeedbackDTO): Promise<FeedbackRecord> {
    return this.repo.create(data);
  }

  async list(filters: FeedbackFilters): Promise<FeedbackListResult> {
    const [listRes, stats] = await Promise.all([this.repo.list(filters), this.repo.getStats()]);

    return {
      rows: listRes.rows,
      stats,
      total: listRes.total,
      page: filters.page,
    };
  }

  async getStats(): Promise<FeedbackStats> {
    return this.repo.getStats();
  }
}

export const feedbackService = new FeedbackService();
