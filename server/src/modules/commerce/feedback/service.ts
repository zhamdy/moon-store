import { IFeedbackRepository, feedbackRepository as defaultRepo } from './repository';
import { CreateFeedbackDTO, FeedbackFilters, FeedbackListResult, FeedbackRecord, FeedbackStats } from './types';

export class FeedbackService {
  constructor(private repo: IFeedbackRepository = defaultRepo) {}

  getRepository(): IFeedbackRepository {
    return this.repo;
  }

  async create(data: CreateFeedbackDTO): Promise<FeedbackRecord> {
    return this.repo.create(data);
  }

  async list(filters: FeedbackFilters): Promise<FeedbackListResult> {
    const pageNum = filters.page ? Number(filters.page) : 1;
    const limitNum = filters.limit ? Number(filters.limit) : 20;

    const [listRes, stats] = await Promise.all([
      this.repo.list({ ...filters, page: pageNum, limit: limitNum }),
      this.repo.getStats(),
    ]);

    return {
      rows: listRes.rows,
      stats,
      total: listRes.total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async getStats(): Promise<FeedbackStats> {
    return this.repo.getStats();
  }
}

export const feedbackService = new FeedbackService();
