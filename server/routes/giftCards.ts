import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';

const router: Router = Router();

// --- Zod Schemas ---

const createGiftCardSchema = z.object({
  code: z.string().min(4).max(50).optional(),
  initial_value: z.number().positive('Initial value must be positive'),
  customer_id: z.number().int().positive().optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

const redeemGiftCardSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  sale_id: z.number().int().positive('Sale ID is required'),
});

const updateGiftCardSchema = z.object({
  status: z.enum(['active', 'cancelled']),
});

// --- Helpers ---

function generateGiftCardCode(): string {
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

function generateGiftCardBarcode(): string {
  const prefix = '890200';

  // Find the max barcode number with this prefix
  const maxResult = db.db
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

// --- Routes ---

// GET /api/gift-cards — List all gift cards (Admin)
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 25, status, search } = req.query;
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
                (SELECT COUNT(*) FROM gift_card_transactions t WHERE t.gift_card_id = gc.id) as transaction_count,
                (SELECT COALESCE(SUM(t.amount), 0) FROM gift_card_transactions t WHERE t.gift_card_id = gc.id) as total_redeemed
         FROM gift_cards gc
         ${whereClause}
         ORDER BY gc.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total, page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/gift-cards — Create a gift card (Admin)
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createGiftCardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { code, initial_value, customer_id, expires_at } = parsed.data;
      const authReq = req as AuthRequest;

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
          authReq.user!.id,
        ]
      );

      logAuditFromReq(req, 'create', 'gift_card', (result.rows[0] as any)?.id, {
        code: finalCode,
        initial_value,
      });

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return res
          .status(409)
          .json({ success: false, error: 'Gift card code or barcode already exists' });
      }
      next(err);
    }
  }
);

// GET /api/gift-cards/:code/balance — Check balance by code (any authenticated user)
router.get(
  '/:code/balance',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query<{
        id: number;
        code: string;
        balance: number;
        initial_value: number;
        status: string;
        expires_at: string | null;
      }>(
        `SELECT id, code, balance, initial_value, status, expires_at FROM gift_cards WHERE code = ?`,
        [req.params.code]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      const card = result.rows[0];

      // Check if expired
      let isExpired = false;
      if (card.expires_at) {
        isExpired = new Date(card.expires_at) < new Date();
      }

      res.json({
        success: true,
        data: {
          code: card.code,
          balance: card.balance,
          initial_value: card.initial_value,
          status: card.status,
          expires_at: card.expires_at,
          is_expired: isExpired,
          is_redeemable: card.status === 'active' && !isExpired && card.balance > 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/gift-cards/:code/redeem — Redeem gift card
router.post(
  '/:code/redeem',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = redeemGiftCardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { amount, sale_id } = parsed.data;
      const authReq = req as AuthRequest;

      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        // Fetch the gift card
        const card = rawDb
          .prepare('SELECT * FROM gift_cards WHERE code = ?')
          .get(req.params.code) as Record<string, any> | undefined;

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
          .get(card.id, sale_id, amount, card.balance, newBalance, authReq.user!.id) as Record<
          string,
          any
        >;

        return {
          transaction,
          new_balance: newBalance,
          code: card.code,
        };
      });

      let result;
      try {
        result = txn();
      } catch (err: any) {
        if (
          err.message === 'Gift card not found' ||
          err.message === 'Gift card is not active' ||
          err.message === 'Gift card has expired' ||
          err.message.startsWith('Insufficient balance')
        ) {
          const statusCode = err.message === 'Gift card not found' ? 404 : 400;
          return res.status(statusCode).json({ success: false, error: err.message });
        }
        throw err;
      }

      logAuditFromReq(req, 'redeem', 'gift_card', undefined, {
        code: result.code,
        amount,
        sale_id,
        new_balance: result.new_balance,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/gift-cards/:id/transactions — View transaction history (Admin)
router.get(
  '/:id/transactions',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify the gift card exists
      const card = await db.query<{ id: number }>('SELECT id FROM gift_cards WHERE id = ?', [
        req.params.id,
      ]);
      if (card.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      const result = await db.query(
        `SELECT t.*, u.name as performed_by_name
         FROM gift_card_transactions t
         LEFT JOIN users u ON t.performed_by = u.id
         WHERE t.gift_card_id = ?
         ORDER BY t.created_at DESC`,
        [req.params.id]
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/gift-cards/:id — Update gift card status (Admin) — activate/cancel
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateGiftCardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { status } = parsed.data;

      const result = await db.query(
        `UPDATE gift_cards SET status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`,
        [status, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      logAuditFromReq(req, 'status_change', 'gift_card', req.params.id, { status });
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
