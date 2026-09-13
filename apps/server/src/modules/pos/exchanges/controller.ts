import { Request, Response, NextFunction } from 'express';
import type { ExchangeFilters } from './types';
import { exchangesRequestContracts, type ExchangeBody } from './schemas';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { exchangesService, ExchangeStockError, IExchangesService } from './service';
import { PublicError } from '../../../http/errors';
import { stockConflictDetails } from '../stockConflict';
import {
  IDEMPOTENCY_REPLAY_HEADER,
  readIdempotencyKey,
  toIdempotencyPublicError,
  withIdempotency,
} from '../../../http/idempotency';
import { paginationMeta } from '../../../http/pagination';
import { success } from '../../../http/responses';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = exchangesRequestContracts;

export class ExchangesController {
  constructor(private service: IExchangesService = exchangesService) {}

  async createExchange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = contracts.createExchange.parseBody<ExchangeBody>(req.body);

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
        // Same detail shape the checkout path sends: one stock refusal, one contract.
        next(
          new PublicError(
            'VALIDATION_ERROR',
            err.message,
            stockConflictDetails(err.conflicts, err.message)
          )
        );
        return;
      }
      // 'Original sale not found' is thrown as a typed PublicError now (#47), so it takes
      // the first branch like any other — no message comparison left to keep in sync.
      next(err);
    }
  }

  async getExchanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listExchanges.parseQuery<ExchangeFilters>(req.query);
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
      const { id } = contracts.getExchange.parseParams<{ id: string }>(req.params);
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
