import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { exchangesService, ExchangeStockError, IExchangesService } from './service';
import { PublicError } from '../../../http/errors';
import {
  IDEMPOTENCY_REPLAY_HEADER,
  readIdempotencyKey,
  toIdempotencyPublicError,
  withIdempotency,
} from '../../../http/idempotency';
import { paginationMeta } from '../../../http/pagination';
import { success } from '../../../http/responses';
import { parseExchangeListQuery } from './types';

const exchangeSchema = z.object({
  original_sale_id: z.number().int().positive(),
  returned_items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().min(0),
        reason: z.string().min(1),
        condition: z.enum(['good', 'damaged', 'defective']).default('good'),
      })
    )
    .min(1),
  new_items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().min(0),
      })
    )
    .min(1),
  payment_method: z.enum(['cash', 'card', 'store_credit']).optional(),
  notes: z.string().max(500).optional(),
});

export class ExchangesController {
  constructor(private service: IExchangesService = exchangesService) {}

  async createExchange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = exchangeSchema.parse(req.body);

      const outcome = await withIdempotency({
        endpoint: 'POST /api/v1/exchanges',
        key: readIdempotencyKey(req),
        userId: authReq.user!.id,
        payload: parsed,
        run: async (client) => {
          const exchange = await this.service.createExchange(parsed, authReq.user!.id, client);
          return {
            status: 201,
            body: success(exchange),
            result: exchange,
            resourceType: 'exchange',
            resourceId: Number(exchange.id),
          };
        },
      });

      if (outcome.replayed) {
        // A replay must not write a second audit entry.
        res.setHeader(IDEMPOTENCY_REPLAY_HEADER, 'true');
      } else {
        const result = outcome.result!;
        logAuditFromReq(req, 'create', 'exchange', result.id, {
          exchange_number: result.exchange_number,
          difference: result.difference,
        });
      }

      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      const conflict = toIdempotencyPublicError(err);
      if (conflict) {
        next(conflict);
        return;
      }
      if (err instanceof ExchangeStockError) {
        next(new PublicError('VALIDATION_ERROR', err.message));
        return;
      }
      next(
        err instanceof z.ZodError || err instanceof PublicError
          ? err
          : err instanceof Error && err.message === 'Original sale not found'
            ? new PublicError('NOT_FOUND', err.message)
            : err
      );
    }
  }

  async getExchanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseExchangeListQuery(req.query);
      const result = await this.service.listExchanges(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getExchangeById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const exchange = await this.service.getExchangeById(id);

      if (!exchange) {
        throw new PublicError('NOT_FOUND', 'Exchange not found');
      }

      res.json(success(exchange));
    } catch (err) {
      next(err);
    }
  }
}

export const exchangesController = new ExchangesController();
