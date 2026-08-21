import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../middleware/auditLogger';
import { couponsService, CouponError } from './service';

const couponSchema = z.object({
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

const validateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  subtotal: z.number().min(0, 'Subtotal must be non-negative'),
  customer_id: z.number().int().positive().optional().nullable(),
  item_product_ids: z.array(z.number().int().positive()).optional().nullable(),
});

export class CouponsController {
  async getCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 25, search, status } = req.query;
      const result = await couponsService.listCoupons({
        page: Number(page),
        limit: Number(limit),
        search: search as string | undefined,
        status: status as string | undefined,
      });

      res.json({
        success: true,
        data: result.coupons,
        meta: { total: result.total, page: result.page, limit: result.limit },
      });
    } catch (err) {
      next(err);
    }
  }

  async createCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = couponSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const coupon = await couponsService.createCoupon(parsed.data);
      logAuditFromReq(req, 'create', 'coupon', coupon.id, {
        code: parsed.data.code,
        type: parsed.data.type,
        value: parsed.data.value,
      });

      res.status(201).json({ success: true, data: coupon });
    } catch (err) {
      if (err instanceof CouponError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async updateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = couponSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const couponId = req.params.id as string;
      const coupon = await couponsService.updateCoupon(couponId, parsed.data);
      logAuditFromReq(req, 'update', 'coupon', couponId, {
        code: parsed.data.code,
        type: parsed.data.type,
        value: parsed.data.value,
      });

      res.json({ success: true, data: coupon });
    } catch (err) {
      if (err instanceof CouponError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async deleteCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const couponId = req.params.id as string;
      await couponsService.deleteCoupon(couponId);
      logAuditFromReq(req, 'delete', 'coupon', couponId);
      res.json({ success: true, data: { message: 'Coupon deactivated' } });
    } catch (err) {
      if (err instanceof CouponError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async validateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = validateCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const result = await couponsService.validateCoupon(parsed.data);
      res.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof CouponError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }
}

export const couponsController = new CouponsController();
