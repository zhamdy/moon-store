// Types owned by the pos slice. Cross-slice contracts (Product, Category,
// ProductVariant, ...) live in `shared/types` instead.

/** Register session from GET /api/v1/register/current and /history */
export interface RegisterSession {
  id: number;
  cashier_id: number;
  cashier_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  expected_cash: number;
  counted_cash: number | null;
  variance: number | null;
  status: 'open' | 'closed';
  notes: string | null;
  sale_count?: number;
  total_in?: number;
  total_out?: number;
  total_sales?: number;
}

/** One cash movement inside a register session */
export interface RegisterMovement {
  id: number;
  session_id: number;
  type: 'sale' | 'refund' | 'cash_in' | 'cash_out';
  amount: number;
  sale_id: number | null;
  note: string | null;
  created_at: string;
}

/** GET /api/v1/register/:id/report */
export interface RegisterReportData {
  session: RegisterSession;
  movements: RegisterMovement[];
  summary: {
    total_sales: number;
    total_refunds: number;
    total_cash_in: number;
    total_cash_out: number;
    sale_count: number;
    refund_count: number;
  };
}

/** Shift from GET /api/v1/shifts/current, /active and /history */
export interface Shift {
  id: number;
  user_id: number;
  user_name: string;
  role?: string;
  clock_in: string;
  clock_out: string | null;
  status: 'active' | 'on_break' | 'completed';
  total_hours: number | null;
  break_minutes: number;
}

/** One person's totals from GET /api/v1/shifts/timesheet */
export interface TimesheetEntry {
  id: number;
  name: string;
  role: string;
  shift_count: number;
  total_hours: number;
  total_break_minutes: number;
}
