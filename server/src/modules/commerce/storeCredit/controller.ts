import { NextFunction, Request, Response } from 'express';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';
import { AuthRequest } from '../../../../middleware/auth';
import { storeCreditService } from './service';
import { storeCreditRequestContracts } from './schemas';

const contracts = storeCreditRequestContracts;

export class StoreCreditController {
  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.getStoreCreditBalance.parseParams<{ id: string }>(req.params);
      const balance = await storeCreditService.getBalance(Number(id));
      if (!balance) {
        throw new PublicError('NOT_FOUND', 'Customer not found');
      }
      res.json(success(balance));
    } catch (err: unknown) {
      next(err);
    }
  }

  async redeem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.redeemStoreCredit.parseParams<{ id: string }>(req.params);
      const body = contracts.redeemStoreCredit.parseBody<{
        amount: number;
        sale_id?: number | null;
      }>(req.body);
      const authReq = req as AuthRequest;

      const result = await storeCreditService.redeem({
        customer_id: Number(id),
        amount: body.amount,
        sale_id: body.sale_id ?? null,
        created_by: authReq.user?.id ?? null,
      });

      res.json(success(result));
    } catch (err: unknown) {
      next(err);
    }
  }

  async issue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.issueStoreCredit.parseParams<{ id: string }>(req.params);
      const body = contracts.issueStoreCredit.parseBody<{ amount: number; reason: string }>(
        req.body
      );
      const authReq = req as AuthRequest;

      const entry = await storeCreditService.issue({
        customer_id: Number(id),
        amount: body.amount,
        reason: body.reason,
        source_type: 'manual',
        created_by: authReq.user?.id ?? null,
      });

      res.status(201).json(success(entry));
    } catch (err: unknown) {
      next(err);
    }
  }
}

export const storeCreditController = new StoreCreditController();
