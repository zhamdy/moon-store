import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';

// --- Types ---

export interface GiftCardFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface GiftCardListResult {
  rows: Record<string, any>[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateGiftCardInput {
  code?: string;
  initial_value: number;
  customer_id?: number | null;
  expires_at?: string | null;
}

export interface GiftCardBalanceResult {
  code: string;
  balance: number;
  initial_value: number;
  status: string;
  expires_at: string | null;
  is_expired: boolean;
  is_redeemable: boolean;
}

export interface RedeemResult {
  transaction: Record<string, any>;
  new_balance: number;
  code: string;
}

// --- Helpers ---

export function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments: string[] = [];
  for (let s = 0; s < 3; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(segment);
  }
  return `GC-${segments.join('-')}`;
}

export async function generateGiftCardBarcode(): Promise<string> {
  const prefix = '890200';

  const maxResult = await db.query<{ max_bc: string | null }>(
    `SELECT MAX(barcode) as max_bc FROM gift_cards WHERE barcode LIKE $1 AND LENGTH(barcode) = 13`,
    [`${prefix}%`]
  );

  let nextSeq: number;
  if (maxResult.rows[0]?.max_bc) {
    const seqPart = maxResult.rows[0].max_bc.substring(prefix.length, 12);
    nextSeq = parseInt(seqPart, 10) + 1;
  } else {
    nextSeq = 1;
  }

  const seqStr = String(nextSeq).padStart(6, '0');
  const partial = prefix + seqStr;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(partial[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return partial + checkDigit;
}

// --- Public API ---

export async function listGiftCards(filters: GiftCardFilters): Promise<GiftCardListResult> {
  const { page = 1, limit = 25, status, search } = filters;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  const where: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (status && status !== 'all') {
    where.push(`gc.status = $${paramIdx++}`);
    params.push(status);
  }
  if (search) {
    where.push(`(gc.code ILIKE $${paramIdx} OR gc.barcode ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countResult = await db.query<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM gift_cards gc ${whereClause}`,
    params
  );
  const total = Number(countResult.rows[0]?.count || 0);

  const queryParams = [...params, limitNum, offset];
  const limitIdx = paramIdx++;
  const offsetIdx = paramIdx++;

  const result = await db.query(
    `SELECT gc.*,
            COALESCE(t_agg.transaction_count, 0)::int as transaction_count,
            COALESCE(t_agg.total_redeemed, 0) as total_redeemed
     FROM gift_cards gc
     LEFT JOIN (
       SELECT gift_card_id, COUNT(*) as transaction_count, SUM(amount) as total_redeemed
       FROM gift_card_transactions GROUP BY gift_card_id
     ) t_agg ON t_agg.gift_card_id = gc.id
     ${whereClause}
     ORDER BY gc.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    queryParams
  );

  return {
    rows: result.rows,
    total,
    page: pageNum,
    limit: limitNum,
  };
}

export async function createGiftCard(
  data: CreateGiftCardInput,
  createdByUserId: number
): Promise<Record<string, any>> {
  const { code, initial_value, customer_id, expires_at } = data;

  let finalCode = code || generateGiftCardCode();
  if (!code) {
    let existing = await db.query<{ id: number }>('SELECT id FROM gift_cards WHERE code = $1', [
      finalCode,
    ]);
    let attempts = 0;
    while (existing.rows.length > 0 && attempts < 10) {
      finalCode = generateGiftCardCode();
      existing = await db.query<{ id: number }>('SELECT id FROM gift_cards WHERE code = $1', [
        finalCode,
      ]);
      attempts++;
    }
  }

  const barcode = await generateGiftCardBarcode();

  const result = await db.query(
    `INSERT INTO gift_cards (code, barcode, initial_value, balance, customer_id, expires_at, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7) RETURNING *`,
    [
      finalCode,
      barcode,
      initial_value,
      initial_value,
      customer_id || null,
      expires_at || null,
      createdByUserId,
    ]
  );

  return result.rows[0];
}

export async function getGiftCardBalance(code: string): Promise<GiftCardBalanceResult | null> {
  const result = await db.query<{
    id: number;
    code: string;
    balance: string | number;
    initial_value: string | number;
    status: string;
    expires_at: string | null;
  }>(
    `SELECT id, code, balance, initial_value, status, expires_at FROM gift_cards WHERE code = $1`,
    [code]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const card = result.rows[0];
  const balance = Number(card.balance);
  const initialValue = Number(card.initial_value);

  let isExpired = false;
  if (card.expires_at) {
    isExpired = new Date(card.expires_at) < new Date();
  }

  return {
    code: card.code,
    balance,
    initial_value: initialValue,
    status: card.status,
    expires_at: card.expires_at,
    is_expired: isExpired,
    is_redeemable: card.status === 'active' && !isExpired && balance > 0,
  };
}

export async function redeemGiftCard(
  code: string,
  amount: number,
  saleId: number,
  performedByUserId: number
): Promise<RedeemResult> {
  return withTransaction(async (client) => {
    const cardRes = await client.query<Record<string, any>>(
      'SELECT * FROM gift_cards WHERE code = $1',
      [code]
    );
    const card = cardRes.rows[0];

    if (!card) {
      throw new Error('Gift card not found');
    }

    if (card.status !== 'active') {
      throw new Error('Gift card is not active');
    }

    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      throw new Error('Gift card has expired');
    }

    const currentBalance = Number(card.balance);
    if (currentBalance < amount) {
      throw new Error(`Insufficient balance. Available: ${currentBalance}`);
    }

    const newBalance = currentBalance - amount;
    await client.query('UPDATE gift_cards SET balance = $1, updated_at = NOW() WHERE id = $2', [
      newBalance,
      card.id,
    ]);

    const txRes = await client.query<Record<string, any>>(
      `INSERT INTO gift_card_transactions (gift_card_id, sale_id, amount, balance_before, balance_after, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [card.id, saleId, amount, currentBalance, newBalance, performedByUserId]
    );

    return {
      transaction: txRes.rows[0],
      new_balance: newBalance,
      code: card.code,
    };
  });
}

export async function getGiftCardTransactions(
  id: number
): Promise<{ card: Record<string, any> | null; transactions: Record<string, any>[] }> {
  const card = await db.query<{ id: number }>('SELECT id FROM gift_cards WHERE id = $1', [id]);
  if (card.rows.length === 0) {
    return { card: null, transactions: [] };
  }

  const result = await db.query(
    `SELECT t.*, u.name as performed_by_name
     FROM gift_card_transactions t
     LEFT JOIN users u ON t.performed_by = u.id
     WHERE t.gift_card_id = $1
     ORDER BY t.created_at DESC`,
    [id]
  );

  return { card: card.rows[0], transactions: result.rows };
}

export async function updateGiftCardStatus(
  id: number | string,
  status: string
): Promise<Record<string, any> | null> {
  const result = await db.query(
    `UPDATE gift_cards SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
