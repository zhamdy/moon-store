import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  giftCardsRequestContracts,
  createGiftCardSchema,
  redeemGiftCardSchema,
  updateGiftCardSchema,
} from './schemas';
import { giftCardTransactionQuerySchema, type GiftCardFilters } from './types';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { giftCardsService } from './service';
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

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = giftCardsRequestContracts;

export class GiftCardsController {
  async listGiftCards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listGiftCards.parseQuery<GiftCardFilters>(req.query);
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
      const parsed = contracts.createGiftCard.parseBody<z.infer<typeof createGiftCardSchema>>(
        req.body
      );

      const authReq = req as AuthRequest;
      const card = await giftCardsService.create(parsed, authReq.user!.id);

      logAuditFromReq(req, 'create', 'gift_card', (card as { id: number })?.id, {
        code: card.code,
        initial_value: parsed.initial_value,
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
      const { code } = contracts.getBalance.parseParams<{ code: string }>(req.params);
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
      const parsed = contracts.redeemGiftCard.parseBody<z.infer<typeof redeemGiftCardSchema>>(
        req.body
      );

      const { amount, sale_id } = parsed;
      const authReq = req as AuthRequest;
      const { code } = contracts.redeemGiftCard.parseParams<{ code: string }>(req.params);

      const outcome = await withIdempotency({
        // Stable per endpoint: the card code is fingerprinted through the payload
        // instead, so one key cannot straddle two different cards.
        endpoint: 'POST /api/v1/gift-cards/:code/redeem',
        key: readIdempotencyKey(req),
        userId: authReq.user!.id,
        payload: { ...parsed, code },
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
      const id = Number(contracts.getTransactions.parseParams<{ id: string }>(req.params).id);
      const query = contracts.getTransactions.parseQuery<
        z.infer<typeof giftCardTransactionQuerySchema>
      >(req.query);
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
      const parsed = contracts.updateGiftCard.parseBody<z.infer<typeof updateGiftCardSchema>>(
        req.body
      );

      const { id } = contracts.updateGiftCard.parseParams<{ id: string }>(req.params);
      const updated = await giftCardsService.updateStatus(id, parsed.status);

      if (!updated) {
        throw new PublicError('NOT_FOUND', 'Gift card not found');
      }

      logAuditFromReq(req, 'status_change', 'gift_card', id, {
        status: parsed.status,
      });
      res.json(success(updated));
    } catch (err) {
      next(err);
    }
  }
}

export const giftCardsController = new GiftCardsController();
