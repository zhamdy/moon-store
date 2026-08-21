import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { notifySale } from '../../../../services/notifications';
import { recordSaleMovement, recordRefundMovement } from '../register';
import { saleSchema, refundSchema } from '../../../../validators/saleSchema';
import { salesService } from './service';
import { salesRepository } from './repository';

export class SalesController {
  async getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 25, payment_method, cashier_id, from, to, search } = req.query;

      const result = await salesRepository.listSales({
        page: Number(page),
        limit: Number(limit),
        search: search as string | undefined,
        payment_method: payment_method as string | undefined,
        cashier_id: cashier_id ? Number(cashier_id) : undefined,
        from: from as string | undefined,
        to: to as string | undefined,
      });

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }

  async getSaleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const saleId = Number(req.params.id);
      const sale = await salesRepository.findById(saleId);
      if (!sale) {
        res.status(404).json({ success: false, error: 'Sale not found' });
        return;
      }

      const items = await salesRepository.findItemsBySaleId(saleId);
      const payments = await salesRepository.findPaymentsBySaleId(saleId);
      const refunds = await salesRepository.findRefundsBySaleId(saleId);

      res.json({
        success: true,
        data: {
          ...sale,
          items,
          payments,
          refunds,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async createSale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = saleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const authReq = req as AuthRequest;
      const cashierId = authReq.user!.id;
      const cashierName = authReq.user!.name;

      const sale = await salesService.executeSale(parsed.data, cashierId);

      const isCash =
        parsed.data.payment_method === 'Cash' ||
        parsed.data.payments?.some((p) => p.method === 'Cash');
      if (isCash) {
        const cashAmount =
          parsed.data.payment_method === 'Cash'
            ? Number(sale.total)
            : Number(parsed.data.payments?.find((p) => p.method === 'Cash')?.amount || 0);
        recordSaleMovement(cashierId, sale.id, cashAmount);
      }

      logAuditFromReq(req, 'create', 'sale', sale.id, {
        total: sale.total,
        payment_method: sale.payment_method,
        item_count: parsed.data.items.length,
      });

      notifySale(Number(sale.total), sale.id, cashierName);

      res.status(201).json({ success: true, data: sale });
    } catch (err: any) {
      if (
        err.message?.includes('Insufficient stock') ||
        err.message?.includes('Insufficient loyalty points') ||
        err.message?.includes('Product not found') ||
        err.message?.includes('Variant not found')
      ) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async refundSale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const saleId = Number(req.params.id);
      const parsed = refundSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const authReq = req as AuthRequest;
      const cashierId = authReq.user!.id;

      const result = await salesService.executeRefund(saleId, parsed.data, cashierId);

      logAuditFromReq(req, 'refund', 'sale', req.params.id as string, {
        refund_amount: result.refund.amount,
      });
      recordRefundMovement(cashierId, Number(result.refund.amount));

      res.status(201).json({
        success: true,
        data: {
          refund: result.refund,
          refund_status: result.refundStatus,
          refunded_amount: result.newRefundedTotal,
        },
      });
    } catch (err: any) {
      if (
        err.message === 'Sale not found' ||
        err.message === 'Sale already fully refunded' ||
        err.message?.includes('not in this sale') ||
        err.message?.includes('exceeds sold quantity') ||
        err.message === 'Refund amount exceeds sale total'
      ) {
        const statusCode = err.message === 'Sale not found' ? 404 : 400;
        res.status(statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }
}

export const salesController = new SalesController();
