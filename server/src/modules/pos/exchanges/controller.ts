import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { exchangesService, IExchangesService } from './service';

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

      const result = await this.service.createExchange(parsed, authReq.user!.id);

      logAuditFromReq(req, 'create', 'exchange', result.id, {
        exchange_number: result.exchange_number,
        difference: result.difference,
      });

      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      if (err.message === 'Original sale not found') {
        res.status(404).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async getExchanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20', search } = req.query;
      const result = await this.service.listExchanges({
        page: page as string,
        limit: limit as string,
        search: search as string | undefined,
      });

      res.json({
        success: true,
        data: result.rows,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  async getExchangeById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const exchange = await this.service.getExchangeById(id);

      if (!exchange) {
        res.status(404).json({ success: false, error: 'Exchange not found' });
        return;
      }

      res.json({
        success: true,
        data: exchange,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const exchangesController = new ExchangesController();
