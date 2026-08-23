import { IAuditLogRepository, auditLogRepository as defaultRepo } from './repository';
import { AuditLogFilters, AuditLogListResult } from './types';

export class AuditLogService {
  constructor(private repo: IAuditLogRepository = defaultRepo) {}

  async list(filters: AuditLogFilters): Promise<AuditLogListResult> {
    const { rows, total } = await this.repo.findLogs(filters);

    return {
      logs: rows,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async getActions(): Promise<string[]> {
    return this.repo.findDistinctActions();
  }

  async getEntityTypes(): Promise<string[]> {
    return this.repo.findDistinctEntityTypes();
  }
}

export const auditLogService = new AuditLogService();
