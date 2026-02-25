import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';
import {
  listGiftCards,
  createGiftCard,
  getGiftCardBalance,
  redeemGiftCard,
  getGiftCardTransactions,
  updateGiftCardStatus,
} from '../services/giftCardService';

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

// --- Routes ---

// GET /api/gift-cards — List all gift cards (Admin)
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, status, search } = req.query;
      const result = await listGiftCards({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status as string | undefined,
        search: search as string | undefined,
      });

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.total, page: result.page, limit: result.limit },
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

      const authReq = req as AuthRequest;
      const card = await createGiftCard(parsed.data, authReq.user!.id);

      logAuditFromReq(req, 'create', 'gift_card', (card as { id: number })?.id, {
        code: card.code,
        initial_value: parsed.data.initial_value,
      });

      res.status(201).json({ success: true, data: card });
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
      const balanceData = await getGiftCardBalance(req.params.code);

      if (!balanceData) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      res.json({ success: true, data: balanceData });
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

      let result;
      try {
        result = redeemGiftCard(req.params.code, amount, sale_id, authReq.user!.id);
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
      const { card, transactions } = await getGiftCardTransactions(Number(req.params.id));

      if (!card) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      res.json({ success: true, data: transactions });
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

      const updated = await updateGiftCardStatus(req.params.id, parsed.data.status);

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      logAuditFromReq(req, 'status_change', 'gift_card', req.params.id, {
        status: parsed.data.status,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
