import db from '../db';

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
  const result = await db.query(
    `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = ? AND status = 'open'`,
    [userId]
  );
  return result.rows[0] as unknown as { id: number; expected_cash: number } | undefined;
}

// --- Public API ---

export async function getCurrentSession(userId: number): Promise<SessionRow | null> {
  const result = await db.query(
    `SELECT rs.*, u.name as cashier_name,
            (SELECT COUNT(*) FROM register_movements WHERE session_id = rs.id AND type = 'sale') as sale_count,
            (SELECT COALESCE(SUM(CASE WHEN type = 'sale' THEN amount WHEN type = 'cash_in' THEN amount ELSE 0 END), 0)
             FROM register_movements WHERE session_id = rs.id) as total_in,
            (SELECT COALESCE(SUM(CASE WHEN type = 'refund' THEN amount WHEN type = 'cash_out' THEN amount ELSE 0 END), 0)
             FROM register_movements WHERE session_id = rs.id) as total_out
     FROM register_sessions rs
     JOIN users u ON rs.cashier_id = u.id
     WHERE rs.cashier_id = ? AND rs.status = 'open'
     ORDER BY rs.opened_at DESC LIMIT 1`,
    [userId]
  );

  return (result.rows[0] as unknown as SessionRow) || null;
}

export async function openSession(
  userId: number,
  openingFloat: number
): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }> {
  // Check if already has an open session
  const existing = await db.query(
    `SELECT id FROM register_sessions WHERE cashier_id = ? AND status = 'open'`,
    [userId]
  );
  if (existing.rows.length > 0) {
    return { error: 'You already have an open register session' };
  }

  const result = await db.query(
    `INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES (?, ?, ?) RETURNING *`,
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
  // Get current open session
  const session = await findOpenSession(userId);
  if (!session) {
    return { error: 'No open register session' };
  }

  const sessionId = session.id;
  const currentExpected = session.expected_cash;

  // Insert movement
  const movement = await db.query(
    `INSERT INTO register_movements (session_id, type, amount, note) VALUES (?, ?, ?, ?) RETURNING *`,
    [sessionId, type, amount, note || null]
  );

  // Update expected cash
  const delta = type === 'cash_in' ? amount : -amount;
  await db.query(`UPDATE register_sessions SET expected_cash = ? WHERE id = ?`, [
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
  // Get current open session
  const session = await findOpenSession(userId);
  if (!session) {
    return { error: 'No open register session' };
  }

  const sessionId = session.id;
  const expectedCash = session.expected_cash;
  const variance = countedCash - expectedCash;

  const result = await db.query(
    `UPDATE register_sessions
     SET status = 'closed', closed_at = datetime('now'), counted_cash = ?, variance = ?, notes = ?
     WHERE id = ?
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
     WHERE rs.id = ?`,
    [sessionId]
  );
  if (session.rows.length === 0) {
    return { error: 'Session not found' };
  }

  const movements = await db.query(
    `SELECT * FROM register_movements WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId]
  );

  // Aggregate by type
  const summary: MovementSummary = {
    total_sales: 0,
    total_refunds: 0,
    total_cash_in: 0,
    total_cash_out: 0,
    sale_count: 0,
    refund_count: 0,
  };

  for (const m of movements.rows as { type: string; amount: number }[]) {
    switch (m.type) {
      case 'sale':
        summary.total_sales += m.amount;
        summary.sale_count++;
        break;
      case 'refund':
        summary.total_refunds += m.amount;
        summary.refund_count++;
        break;
      case 'cash_in':
        summary.total_cash_in += m.amount;
        break;
      case 'cash_out':
        summary.total_cash_out += m.amount;
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

  let where = '1=1';
  const params: unknown[] = [];

  if (cashier_id) {
    where += ' AND rs.cashier_id = ?';
    params.push(cashier_id);
  }
  if (from) {
    where += ' AND rs.opened_at >= ?';
    params.push(from);
  }
  if (to) {
    where += " AND rs.opened_at <= ? || ' 23:59:59'";
    params.push(to);
  }

  const countResult = await db.query(
    `SELECT COUNT(*) as total FROM register_sessions rs WHERE ${where}`,
    params
  );

  const result = await db.query(
    `SELECT rs.*, u.name as cashier_name,
            (SELECT COUNT(*) FROM register_movements WHERE session_id = rs.id AND type = 'sale') as sale_count,
            (SELECT COALESCE(SUM(amount), 0) FROM register_movements WHERE session_id = rs.id AND type = 'sale') as total_sales
     FROM register_sessions rs
     JOIN users u ON rs.cashier_id = u.id
     WHERE ${where}
     ORDER BY rs.opened_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );

  return {
    rows: result.rows as unknown as SessionRow[],
    meta: {
      total: countResult.rows[0].total as number,
      page: Number(page),
      limit: Number(limit),
    },
  };
}

export async function forceCloseSession(
  sessionId: number | string
): Promise<{ session: SessionRow; error?: undefined } | { session?: undefined; error: string }> {
  const session = await db.query(
    `SELECT id, expected_cash FROM register_sessions WHERE id = ? AND status = 'open'`,
    [sessionId]
  );
  if (session.rows.length === 0) {
    return { error: 'No open session found' };
  }

  const result = await db.query(
    `UPDATE register_sessions
     SET status = 'closed', closed_at = datetime('now'), notes = COALESCE(notes || ' | ', '') || 'Force-closed by admin'
     WHERE id = ?
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
    const session = await db.query(
      `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = ? AND status = 'open'`,
      [cashierId]
    );
    if (session.rows.length === 0) return; // No open session, skip

    const sessionId = session.rows[0].id;

    await db.query(
      `INSERT INTO register_movements (session_id, type, amount, sale_id) VALUES (?, 'sale', ?, ?)`,
      [sessionId, cashAmount, saleId]
    );

    await db.query(`UPDATE register_sessions SET expected_cash = expected_cash + ? WHERE id = ?`, [
      cashAmount,
      sessionId,
    ]);

    // Also link the sale to the session
    await db.query(`UPDATE sales SET register_session_id = ? WHERE id = ?`, [sessionId, saleId]);
  } catch {
    // Don't fail the sale if register tracking fails
  }
}

export async function recordRefundMovement(cashierId: number, amount: number): Promise<void> {
  try {
    const session = await db.query(
      `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = ? AND status = 'open'`,
      [cashierId]
    );
    if (session.rows.length === 0) return;

    const sessionId = session.rows[0].id;

    await db.query(
      `INSERT INTO register_movements (session_id, type, amount) VALUES (?, 'refund', ?)`,
      [sessionId, amount]
    );

    await db.query(`UPDATE register_sessions SET expected_cash = expected_cash - ? WHERE id = ?`, [
      amount,
      sessionId,
    ]);
  } catch {
    // Don't fail the refund if register tracking fails
  }
}
