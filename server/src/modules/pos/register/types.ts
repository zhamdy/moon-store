export interface SessionRow {
  id: number;
  cashier_id: number;
  opening_float: number;
  expected_cash: number;
  counted_cash: number | null;
  variance: number | null;
  status: string;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  cashier_name?: string;
  sale_count?: number;
  total_in?: number;
  total_out?: number;
  total_sales?: number;
}

export interface MovementRow {
  id: number;
  session_id: number;
  type: string;
  amount: number;
  note: string | null;
  sale_id: number | null;
  created_at: string;
}

export interface MovementSummary {
  total_sales: number;
  total_refunds: number;
  total_cash_in: number;
  total_cash_out: number;
  sale_count: number;
  refund_count: number;
}

export interface SessionReport {
  session: SessionRow;
  movements: MovementRow[];
  summary: MovementSummary;
}

export interface SessionHistoryFilters {
  page: number;
  pageSize: number;
  cashierId?: number;
  from?: string;
  to?: string;
  sortBy: 'openedAt' | 'closedAt';
  sortOrder: 'asc' | 'desc';
}

export interface SessionHistoryResult {
  rows: SessionRow[];
  total: number;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');
const historyQuerySchema = createListQuerySchema(['openedAt', 'closedAt'] as const)
  .extend({
    cashierId: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().positive())
      .optional(),
    from: date.optional(),
    to: date.optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'openedAt', ...query }));

export function parseSessionHistoryQuery(query: unknown): SessionHistoryFilters {
  return historyQuerySchema.parse(query);
}

export interface OpenRegisterDTO {
  opening_float: number;
}

export interface AddMovementDTO {
  type: 'cash_in' | 'cash_out';
  amount: number;
  note?: string;
}

export interface CloseRegisterDTO {
  counted_cash: number;
  notes?: string;
}
import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';
