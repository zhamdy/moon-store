export interface AuditLogEntry {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | number | null;
  details?: any;
  ip_address?: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  userId?: number | string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogListResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
