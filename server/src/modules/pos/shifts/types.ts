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
  user_id?: string | number;
  from?: string;
  to?: string;
  page?: string | number;
  limit?: string | number;
}

export interface ShiftListResult {
  rows: ShiftRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
