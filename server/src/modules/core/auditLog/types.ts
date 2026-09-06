import { z } from 'zod';

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
  userId?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface AuditLogListResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const positiveInteger = (field: string) =>
  z
    .string()
    .regex(/^\d+$/, `${field} must be a positive integer`)
    .transform(Number)
    .pipe(z.number().int().positive());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

export const auditLogListQuerySchema = z
  .object({
    page: positiveInteger('page').default('1'),
    pageSize: z.enum(['10', '25', '50', '100']).default('50').transform(Number),
    userId: positiveInteger('userId').optional(),
    action: z.string().trim().min(1).max(50).optional(),
    entityType: z.string().trim().min(1).max(50).optional(),
    entityId: z.string().trim().min(1).max(100).optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: 'dateFrom must not be after dateTo',
  });

export function parseAuditLogListQuery(input: unknown): AuditLogFilters {
  return auditLogListQuerySchema.parse(input);
}
