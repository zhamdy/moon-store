import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { couponsService } from './service';
import { CouponError } from './types';
import { parseCouponListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

const couponPublicError = (error: CouponError) =>
  new PublicError(
    error.statusCode === 404
      ? 'NOT_FOUND'
      : error.statusCode === 409
        ? 'CONFLICT'
        : 'VALIDATION_ERROR',
    error.message
  );

export const couponSchema = z.object({
  code: z
    .string()
    .min(3, 'Coupon code must be at least 3 characters')
    .max(50)
    .transform((v) => v.toUpperCase().trim()),
  type: z.enum(['percentage', 'fixed'], {
    required_error: 'Type must be "percentage" or "fixed"',
  }),
  value: z.number().positive('Value must be positive'),
  min_purchase: z.number().min(0).optional().nullable(),
  max_discount: z.number().positive().optional().nullable(),
  starts_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  max_uses_per_customer: z.number().int().positive().optional().nullable(),
  scope: z.enum(['all', 'category', 'product']).default('all'),
  scope_ids: z.array(z.number().int().positive()).optional().nullable(),
  stackable: z.boolean().optional().default(false),
});

/**
 * The update body is a genuine partial — same reasoning as #78 on collections.
 *
 * The create schema is all-optional-with-defaults, and the repository wrote all twelve
 * columns from it, so the Promotions page — whose form has no field for
 * `max_uses_per_customer` or `scope_ids` — cleared a per-customer limit and a
 * category/product restriction on every edit. A coupon scoped to one category quietly
 * became valid on everything.
 *
 * No `.default()` here: a default turns "absent" back into "write this value".
 */
export const couponUpdateSchema = z.object({
  code: z
    .string()
    .min(3, 'Coupon code must be at least 3 characters')
    .max(50)
    .transform((v) => v.toUpperCase().trim())
    .optional(),
  type: z.enum(['percentage', 'fixed']).optional(),
  value: z.number().positive('Value must be positive').optional(),
  min_purchase: z.number().min(0).nullable().optional(),
  max_discount: z.number().positive().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  max_uses_per_customer: z.number().int().positive().nullable().optional(),
  scope: z.enum(['all', 'category', 'product']).optional(),
  scope_ids: z.array(z.number().int().positive()).nullable().optional(),
  stackable: z.boolean().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  subtotal: z.number().min(0, 'Subtotal must be non-negative'),
  customer_id: z.number().int().positive().optional().nullable(),
  item_product_ids: z.array(z.number().int().positive()).optional().nullable(),
});

export class CouponsController {
  async listCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseCouponListQuery(req.query);
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
      const parsed = couponSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const coupon = await couponsService.create(parsed.data);
      logAuditFromReq(req, 'create', 'coupon', coupon.id, {
        code: parsed.data.code,
        type: parsed.data.type,
        value: parsed.data.value,
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
      const parsed = couponUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const id = req.params.id as string;
      const coupon = await couponsService.update(id, parsed.data);
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
      const id = req.params.id as string;
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
      const parsed = validateCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const result = await couponsService.validate(parsed.data);
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
