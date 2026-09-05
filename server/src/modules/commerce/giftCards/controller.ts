import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { giftCardsService } from './service';
import { parseGiftCardListQuery, parseGiftCardTransactionQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';
import {
  IDEMPOTENCY_REPLAY_HEADER,
  readIdempotencyKey,
  toIdempotencyPublicError,
  withIdempotency,
} from '../../../http/idempotency';
import { isUniqueViolation } from '../../../database/constraintErrors';

export const createGiftCardSchema = z.object({
  code: z.string().min(4).max(50).optional(),
  initial_value: z.number().positive('Initial value must be positive'),
  customer_id: z.number().int().positive().optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

export const redeemGiftCardSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  sale_id: z.number().int().positive('Sale ID is required'),
});

export const updateGiftCardSchema = z.object({
  status: z.enum(['active', 'cancelled']),
});

export class GiftCardsController {
  async listGiftCards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseGiftCardListQuery(req.query);
      const result = await giftCardsService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createGiftCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createGiftCardSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const authReq = req as AuthRequest;
      const card = await giftCardsService.create(parsed.data, authReq.user!.id);

      logAuditFromReq(req, 'create', 'gift_card', (card as { id: number })?.id, {
        code: card.code,
        initial_value: parsed.data.initial_value,
      });

      res.status(201).json(success(card));
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'Gift card code or barcode already exists'));
        return;
      }
      next(err);
    }
  }

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.params.code as string;
      const balanceData = await giftCardsService.getBalance(code);

      if (!balanceData) {
        throw new PublicError('NOT_FOUND', 'Gift card not found');
      }

      res.json(success(balanceData));
    } catch (err) {
      next(err);
    }
  }

  async redeemGiftCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = redeemGiftCardSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const { amount, sale_id } = parsed.data;
      const authReq = req as AuthRequest;
      const code = req.params.code as string;

      const outcome = await withIdempotency({
        // Stable per endpoint: the card code is fingerprinted through the payload
        // instead, so one key cannot straddle two different cards.
        endpoint: 'POST /api/v1/gift-cards/:code/redeem',
        key: readIdempotencyKey(req),
        userId: authReq.user!.id,
        payload: { ...parsed.data, code },
        run: async (client) => {
          const redeemed = await giftCardsService.redeem(
            code,
            amount,
            sale_id,
            authReq.user!.id,
            client
          );
          return { status: 200, body: success(redeemed), result: redeemed };
        },
      });

      if (outcome.replayed) {
        // A replay must not write a second audit entry.
        res.setHeader(IDEMPOTENCY_REPLAY_HEADER, 'true');
      } else {
        const result = outcome.result!;
        logAuditFromReq(req, 'redeem', 'gift_card', undefined, {
          code: result.code,
          amount,
          sale_id,
          new_balance: result.new_balance,
        });
      }

      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      const conflict = toIdempotencyPublicError(err);
      if (conflict) {
        next(conflict);
        return;
      }
      next(err);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id as string);
      const query = parseGiftCardTransactionQuery(req.query);
      const { card, transactions, total } = await giftCardsService.getTransactions(
        id,
        query.page,
        query.pageSize,
        query.sortOrder
      );

      if (!card) {
        throw new PublicError('NOT_FOUND', 'Gift card not found');
      }

      res.json(
        success(transactions, { pagination: paginationMeta(query.page, query.pageSize, total) })
      );
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateGiftCardSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const id = req.params.id as string;
      const updated = await giftCardsService.updateStatus(id, parsed.data.status);

      if (!updated) {
        throw new PublicError('NOT_FOUND', 'Gift card not found');
      }

      logAuditFromReq(req, 'status_change', 'gift_card', id, {
        status: parsed.data.status,
      });
      res.json(success(updated));
    } catch (err) {
      next(err);
    }
  }
}

export const giftCardsController = new GiftCardsController();
