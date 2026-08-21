import { IAuditLogRepository, auditLogRepository as defaultRepo } from './repository';
import { AuditLogFilters, AuditLogListResult } from './types';

export class AuditLogService {
  constructor(private repo: IAuditLogRepository = defaultRepo) {}

  async list(filters: AuditLogFilters): Promise<AuditLogListResult> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;

    const { rows, total } = await this.repo.findLogs({ ...filters, page, limit });

    return {
      logs: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getActions(): Promise<string[]> {
    return this.repo.findDistinctActions();
  }
}

export const auditLogService = new AuditLogService();
