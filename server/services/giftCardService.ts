import db from '../db';

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
  // Format: GC-XXXX-XXXX-XXXX (alphanumeric)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude confusable chars (0/O, 1/I)
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

export function generateGiftCardBarcode(): string {
  const prefix = '890200';

  // Find the max barcode number with this prefix
  const rawDb = db.db;
  const maxResult = rawDb
    .prepare(
      `SELECT MAX(barcode) as max_bc FROM gift_cards WHERE barcode LIKE ? AND LENGTH(barcode) = 13`
    )
    .get(`${prefix}%`) as { max_bc: string | null } | undefined;

  let nextSeq: number;
  if (maxResult?.max_bc) {
    const seqPart = maxResult.max_bc.substring(prefix.length, 12); // 6 digits
    nextSeq = parseInt(seqPart, 10) + 1;
  } else {
    nextSeq = 1;
  }

  const seqStr = String(nextSeq).padStart(6, '0');
  const partial = prefix + seqStr; // 12 digits

  // Calculate EAN-13 check digit
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

  if (status && status !== 'all') {
    where.push(`gc.status = ?`);
    params.push(status);
  }
  if (search) {
    where.push(`(gc.code LIKE ? OR gc.barcode LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countResult = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM gift_cards gc ${whereClause}`,
    params
  );
  const total = countResult.rows[0].count;

  const result = await db.query(
    `SELECT gc.*,
            COALESCE(t_agg.transaction_count, 0) as transaction_count,
            COALESCE(t_agg.total_redeemed, 0) as total_redeemed
     FROM gift_cards gc
     LEFT JOIN (
       SELECT gift_card_id, COUNT(*) as transaction_count, SUM(amount) as total_redeemed
       FROM gift_card_transactions GROUP BY gift_card_id
     ) t_agg ON t_agg.gift_card_id = gc.id
     ${whereClause}
     ORDER BY gc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
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

  // Generate code if not provided, ensuring uniqueness
  let finalCode = code || generateGiftCardCode();
  if (!code) {
    // Ensure generated code is unique
    let existing = await db.query<{ id: number }>('SELECT id FROM gift_cards WHERE code = ?', [
      finalCode,
    ]);
    let attempts = 0;
    while (existing.rows.length > 0 && attempts < 10) {
      finalCode = generateGiftCardCode();
      existing = await db.query<{ id: number }>('SELECT id FROM gift_cards WHERE code = ?', [
        finalCode,
      ]);
      attempts++;
    }
  }

  const barcode = generateGiftCardBarcode();

  const result = await db.query(
    `INSERT INTO gift_cards (code, barcode, initial_value, balance, customer_id, expires_at, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?) RETURNING *`,
    [
      finalCode,
      barcode,
      initial_value,
      initial_value, // balance starts equal to initial_value
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
    balance: number;
    initial_value: number;
    status: string;
    expires_at: string | null;
  }>(`SELECT id, code, balance, initial_value, status, expires_at FROM gift_cards WHERE code = ?`, [
    code,
  ]);

  if (result.rows.length === 0) {
    return null;
  }

  const card = result.rows[0];

  // Check if expired
  let isExpired = false;
  if (card.expires_at) {
    isExpired = new Date(card.expires_at) < new Date();
  }

  return {
    code: card.code,
    balance: card.balance,
    initial_value: card.initial_value,
    status: card.status,
    expires_at: card.expires_at,
    is_expired: isExpired,
    is_redeemable: card.status === 'active' && !isExpired && card.balance > 0,
  };
}

export function redeemGiftCard(
  code: string,
  amount: number,
  saleId: number,
  performedByUserId: number
): RedeemResult {
  const rawDb = db.db;
  const txn = rawDb.transaction(() => {
    // Fetch the gift card
    const card = rawDb.prepare('SELECT * FROM gift_cards WHERE code = ?').get(code) as
      | Record<string, any>
      | undefined;

    if (!card) {
      throw new Error('Gift card not found');
    }

    if (card.status !== 'active') {
      throw new Error('Gift card is not active');
    }

    // Check expiration
    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      throw new Error('Gift card has expired');
    }

    if (card.balance < amount) {
      throw new Error(`Insufficient balance. Available: ${card.balance}`);
    }

    // Deduct balance
    const newBalance = card.balance - amount;
    rawDb
      .prepare("UPDATE gift_cards SET balance = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newBalance, card.id);

    // Create transaction record
    const transaction = rawDb
      .prepare(
        `INSERT INTO gift_card_transactions (gift_card_id, sale_id, amount, balance_before, balance_after, performed_by)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(card.id, saleId, amount, card.balance, newBalance, performedByUserId) as Record<
      string,
      any
    >;

    return {
      transaction,
      new_balance: newBalance,
      code: card.code,
    };
  });

  return txn();
}

export async function getGiftCardTransactions(
  id: number
): Promise<{ card: Record<string, any> | null; transactions: Record<string, any>[] }> {
  // Verify the gift card exists
  const card = await db.query<{ id: number }>('SELECT id FROM gift_cards WHERE id = ?', [id]);
  if (card.rows.length === 0) {
    return { card: null, transactions: [] };
  }

  const result = await db.query(
    `SELECT t.*, u.name as performed_by_name
     FROM gift_card_transactions t
     LEFT JOIN users u ON t.performed_by = u.id
     WHERE t.gift_card_id = ?
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
    `UPDATE gift_cards SET status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`,
    [status, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
