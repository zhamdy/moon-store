import db from '../src/database/pool';

// --- Types ---

interface SessionRow {
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

interface MovementRow {
  id: number;
  session_id: number;
  type: string;
  amount: number;
  note: string | null;
  sale_id: number | null;
  created_at: string;
}

interface MovementSummary {
  total_sales: number;
  total_refunds: number;
  total_cash_in: number;
  total_cash_out: number;
  sale_count: number;
  refund_count: number;
}

interface SessionReport {
  session: SessionRow;
  movements: MovementRow[];
  summary: MovementSummary;
}

interface SessionHistoryFilters {
  page?: string;
  limit?: string;
  cashier_id?: string;
  from?: string;
  to?: string;
}

interface SessionHistoryResult {
  rows: SessionRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

// --- Helpers ---

async function findOpenSession(userId: number) {
  const result = await db.query<{ id: number; expected_cash: number }>(
    `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = $1 AND status = 'open'`,
    [userId]
  );
  return result.rows[0];
}

// --- Public API ---

export async function getCurrentSession(userId: number): Promise<SessionRow | null> {
  const result = await db.query(
    `SELECT rs.*, u.name as cashier_name,
            COUNT(CASE WHEN rm.type = 'sale' THEN 1 END)::int as sale_count,
            COALESCE(SUM(CASE WHEN rm.type IN ('sale','cash_in') THEN rm.amount ELSE 0 END), 0) as total_in,
            COALESCE(SUM(CASE WHEN rm.type IN ('refund','cash_out') THEN rm.amount ELSE 0 END), 0) as total_out
     FROM register_sessions rs
     JOIN users u ON rs.cashier_id = u.id
     LEFT JOIN register_movements rm ON rm.session_id = rs.id
     WHERE rs.cashier_id = $1 AND rs.status = 'open'
     GROUP BY rs.id, u.name
     ORDER BY rs.opened_at DESC LIMIT 1`,
    [userId]
  );

  return (result.rows[0] as unknown as SessionRow) || null;
}

export async function openSession(
  userId: number,
  openingFloat: number
): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }> {
  const existing = await db.query(
    `SELECT id FROM register_sessions WHERE cashier_id = $1 AND status = 'open'`,
    [userId]
  );
  if (existing.rows.length > 0) {
    return { error: 'You already have an open register session' };
  }

  const result = await db.query(
    `INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES ($1, $2, $3) RETURNING *`,
    [userId, openingFloat, openingFloat]
  );

  return { session: result.rows[0] as unknown as SessionRow };
}

export async function addMovement(
  userId: number,
  type: 'cash_in' | 'cash_out',
  amount: number,
  note?: string
): Promise<{ movement: MovementRow; error?: undefined } | { movement?: undefined; error: string }> {
  const session = await findOpenSession(userId);
  if (!session) {
    return { error: 'No open register session' };
  }

  const sessionId = session.id;
  const currentExpected = Number(session.expected_cash);

  const movement = await db.query(
    `INSERT INTO register_movements (session_id, type, amount, note) VALUES ($1, $2, $3, $4) RETURNING *`,
    [sessionId, type, amount, note || null]
  );

  const delta = type === 'cash_in' ? amount : -amount;
  await db.query(`UPDATE register_sessions SET expected_cash = $1 WHERE id = $2`, [
    currentExpected + delta,
    sessionId,
  ]);

  return { movement: movement.rows[0] as unknown as MovementRow };
}

export async function closeSession(
  userId: number,
  countedCash: number,
  notes?: string
): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }> {
  const session = await findOpenSession(userId);
  if (!session) {
    return { error: 'No open register session' };
  }

  const sessionId = session.id;
  const expectedCash = Number(session.expected_cash);
  const variance = countedCash - expectedCash;

  const result = await db.query(
    `UPDATE register_sessions
     SET status = 'closed', closed_at = NOW(), counted_cash = $1, variance = $2, notes = $3
     WHERE id = $4
     RETURNING *`,
    [countedCash, variance, notes || null, sessionId]
  );

  return { session: result.rows[0] as unknown as SessionRow };
}

export async function getSessionReport(
  sessionId: number | string
): Promise<{ report: SessionReport; error?: undefined } | { report?: undefined; error: string }> {
  const session = await db.query(
    `SELECT rs.*, u.name as cashier_name
     FROM register_sessions rs
     JOIN users u ON rs.cashier_id = u.id
     WHERE rs.id = $1`,
    [sessionId]
  );
  if (session.rows.length === 0) {
    return { error: 'Session not found' };
  }

  const movements = await db.query(
    `SELECT * FROM register_movements WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );

  const summary: MovementSummary = {
    total_sales: 0,
    total_refunds: 0,
    total_cash_in: 0,
    total_cash_out: 0,
    sale_count: 0,
    refund_count: 0,
  };

  for (const m of movements.rows as { type: string; amount: string | number }[]) {
    const amt = Number(m.amount);
    switch (m.type) {
      case 'sale':
        summary.total_sales += amt;
        summary.sale_count++;
        break;
      case 'refund':
        summary.total_refunds += amt;
        summary.refund_count++;
        break;
      case 'cash_in':
        summary.total_cash_in += amt;
        break;
      case 'cash_out':
        summary.total_cash_out += amt;
        break;
    }
  }

  return {
    report: {
      session: session.rows[0] as unknown as SessionRow,
      movements: movements.rows as unknown as MovementRow[],
      summary,
    },
  };
}

export async function getSessionHistory(
  filters: SessionHistoryFilters
): Promise<SessionHistoryResult> {
  const { page = '1', limit = '25', cashier_id, from, to } = filters;
  const offset = (Number(page) - 1) * Number(limit);

  const where: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (cashier_id) {
    where.push(`rs.cashier_id = $${paramIdx++}`);
    params.push(cashier_id);
  }
  if (from) {
    where.push(`rs.opened_at >= $${paramIdx++}`);
    params.push(from);
  }
  if (to) {
    where.push(`rs.opened_at <= $${paramIdx++}`);
    params.push(to + ' 23:59:59');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countResult = await db.query<{ total: string | number }>(
    `SELECT COUNT(*) as total FROM register_sessions rs ${whereClause}`,
    params
  );

  const queryParams = [...params, Number(limit), offset];
  const limitIdx = paramIdx++;
  const offsetIdx = paramIdx++;

  const result = await db.query(
    `SELECT rs.*, u.name as cashier_name,
            (SELECT COUNT(*) FROM register_movements WHERE session_id = rs.id AND type = 'sale')::int as sale_count,
            (SELECT COALESCE(SUM(amount), 0) FROM register_movements WHERE session_id = rs.id AND type = 'sale') as total_sales
     FROM register_sessions rs
     JOIN users u ON rs.cashier_id = u.id
     ${whereClause}
     ORDER BY rs.opened_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    queryParams
  );

  return {
    rows: result.rows as unknown as SessionRow[],
    meta: {
      total: Number(countResult.rows[0]?.total || 0),
      page: Number(page),
      limit: Number(limit),
    },
  };
}

export async function forceCloseSession(
  sessionId: number | string
): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }> {
  const session = await db.query(
    `SELECT id, expected_cash FROM register_sessions WHERE id = $1 AND status = 'open'`,
    [sessionId]
  );
  if (session.rows.length === 0) {
    return { error: 'No open session found' };
  }

  const result = await db.query(
    `UPDATE register_sessions
     SET status = 'closed', closed_at = NOW(), notes = COALESCE(notes || ' | ', '') || 'Force-closed by admin'
     WHERE id = $1
     RETURNING *`,
    [sessionId]
  );

  return { session: result.rows[0] as unknown as SessionRow };
}

export async function recordSaleMovement(
  cashierId: number,
  saleId: number,
  cashAmount: number
): Promise<void> {
  try {
    const session = await db.query<{ id: number }>(
      `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = $1 AND status = 'open'`,
      [cashierId]
    );
    if (session.rows.length === 0) return;

    const sessionId = session.rows[0].id;

    await db.query(
      `INSERT INTO register_movements (session_id, type, amount, sale_id) VALUES ($1, 'sale', $2, $3)`,
      [sessionId, cashAmount, saleId]
    );

    await db.query(
      `UPDATE register_sessions SET expected_cash = expected_cash + $1 WHERE id = $2`,
      [cashAmount, sessionId]
    );

    await db.query(`UPDATE sales SET register_session_id = $1 WHERE id = $2`, [sessionId, saleId]);
  } catch {
    // Don't fail the sale if register tracking fails
  }
}

export async function recordRefundMovement(cashierId: number, amount: number): Promise<void> {
  try {
    const session = await db.query<{ id: number }>(
      `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = $1 AND status = 'open'`,
      [cashierId]
    );
    if (session.rows.length === 0) return;

    const sessionId = session.rows[0].id;

    await db.query(
      `INSERT INTO register_movements (session_id, type, amount) VALUES ($1, 'refund', $2)`,
      [sessionId, amount]
    );

    await db.query(
      `UPDATE register_sessions SET expected_cash = expected_cash - $1 WHERE id = $2`,
      [amount, sessionId]
    );
  } catch {
    // Don't fail the refund if register tracking fails
  }
}
