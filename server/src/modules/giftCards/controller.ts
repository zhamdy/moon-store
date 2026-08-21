import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';
import { giftCardsService } from './service';

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

export class GiftCardsController {
  async getGiftCards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, search } = req.query;
      const result = await giftCardsService.listGiftCards({
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

  async createGiftCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createGiftCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const authReq = req as AuthRequest;
      const card = await giftCardsService.createGiftCard(parsed.data, authReq.user!.id);

      logAuditFromReq(req, 'create', 'gift_card', (card as { id: number })?.id, {
        code: card.code,
        initial_value: parsed.data.initial_value,
      });

      res.status(201).json({ success: true, data: card });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        res.status(409).json({ success: false, error: 'Gift card code or barcode already exists' });
        return;
      }
      next(err);
    }
  }

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const balanceData = await giftCardsService.getGiftCardBalance(req.params.code as string);
      if (!balanceData) {
        res.status(404).json({ success: false, error: 'Gift card not found' });
        return;
      }

      res.json({ success: true, data: balanceData });
    } catch (err) {
      next(err);
    }
  }

  async redeem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = redeemGiftCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const { amount, sale_id } = parsed.data;
      const authReq = req as AuthRequest;

      let result;
      try {
        result = await giftCardsService.redeemGiftCard(
          req.params.code as string,
          amount,
          sale_id,
          authReq.user!.id
        );
      } catch (err: any) {
        if (
          err.message === 'Gift card not found' ||
          err.message === 'Gift card is not active' ||
          err.message === 'Gift card has expired' ||
          err.message.startsWith('Insufficient balance')
        ) {
          const statusCode = err.message === 'Gift card not found' ? 404 : 400;
          res.status(statusCode).json({ success: false, error: err.message });
          return;
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

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { card, transactions } = await giftCardsService.getGiftCardTransactions(
        Number(req.params.id)
      );

      if (!card) {
        res.status(404).json({ success: false, error: 'Gift card not found' });
        return;
      }

      res.json({ success: true, data: transactions });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateGiftCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const updated = await giftCardsService.updateGiftCardStatus(
        req.params.id as string,
        parsed.data.status
      );

      if (!updated) {
        res.status(404).json({ success: false, error: 'Gift card not found' });
        return;
      }

      logAuditFromReq(req, 'status_change', 'gift_card', req.params.id as string, {
        status: parsed.data.status,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
}

export const giftCardsController = new GiftCardsController();
