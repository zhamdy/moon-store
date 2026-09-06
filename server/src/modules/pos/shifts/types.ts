import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

export interface ShiftRow {
  id: number;
  user_id: number;
  branch_id: number | null;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_minutes: number;
  total_hours: number | null;
  status: 'active' | 'on_break' | 'completed';
  notes: string | null;
  created_at?: string;
  user_name?: string;
  user_email?: string;
  branch_name?: string;
}

export interface ClockInDTO {
  branch_id?: number;
  notes?: string;
}

export interface ClockOutDTO {
  notes?: string;
}

export interface ShiftFilters {
  userId?: number;
  status?: 'open' | 'completed';
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
  sortBy: 'clockIn' | 'clockOut';
  sortOrder: 'asc' | 'desc';
}

export interface ShiftListResult {
  rows: ShiftRow[];
  total: number;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');
export const shiftListQuerySchema = createListQuerySchema(['clockIn', 'clockOut'] as const)
  .extend({
    userId: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().positive())
      .optional(),
    status: z.enum(['open', 'completed']).optional(),
    from: date.optional(),
    to: date.optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'clockIn', ...query }));

export function parseShiftListQuery(query: unknown): ShiftFilters {
  return shiftListQuerySchema.parse(query);
}
