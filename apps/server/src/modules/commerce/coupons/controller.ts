import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  couponsRequestContracts,
  couponSchema,
  couponUpdateSchema,
  validateCouponSchema,
} from './schemas';
import type { CouponFilters } from './types';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { couponsService } from './service';
import { CouponError } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

export const couponPublicError = (error: CouponError) =>
  new PublicError(
    error.statusCode === 404
      ? 'NOT_FOUND'
      : error.statusCode === 409
        ? 'CONFLICT'
        : 'VALIDATION_ERROR',
    error.message
  );

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = couponsRequestContracts;

export class CouponsController {
  async listCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listCoupons.parseQuery<CouponFilters>(req.query);
      const result = await couponsService.list(query);
      res.json(
        success(result.coupons, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createCoupon.parseBody<z.infer<typeof couponSchema>>(req.body);

      const coupon = await couponsService.create(parsed);
      logAuditFromReq(req, 'create', 'coupon', coupon.id, {
        code: parsed.code,
        type: parsed.type,
        value: parsed.value,
      });

      res.status(201).json(success(coupon));
    } catch (err) {
      if (err instanceof CouponError) {
        next(couponPublicError(err));
        return;
      }
      next(err);
    }
  }

  async updateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.updateCoupon.parseBody<z.infer<typeof couponUpdateSchema>>(req.body);

      const { id } = contracts.updateCoupon.parseParams<{ id: string }>(req.params);
      const coupon = await couponsService.update(id, parsed);
      // The audit entry reads the *result*, not the request: a partial body may not
      // mention code/type/value at all, and an audit line of three undefineds records
      // nothing about what the coupon now is.
      logAuditFromReq(req, 'update', 'coupon', id, {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      });

      res.json(success(coupon));
    } catch (err) {
      if (err instanceof CouponError) {
        next(couponPublicError(err));
        return;
      }
      next(err);
    }
  }

  async deleteCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.deleteCoupon.parseParams<{ id: string }>(req.params);
      await couponsService.delete(id);
      logAuditFromReq(req, 'delete', 'coupon', id);
      res.status(204).send();
    } catch (err) {
      if (err instanceof CouponError) {
        next(couponPublicError(err));
        return;
      }
      next(err);
    }
  }

  async validateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.validateCoupon.parseBody<z.infer<typeof validateCouponSchema>>(
        req.body
      );

      const result = await couponsService.validate(parsed);
      res.json(success(result));
    } catch (err) {
      if (err instanceof CouponError) {
        next(couponPublicError(err));
        return;
      }
      next(err);
    }
  }
}

export const couponsController = new CouponsController();
