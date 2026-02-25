import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, requireRole } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  CouponError,
} from '../services/couponService';

const router: Router = Router();

// --- Zod Schemas ---

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

// GET /api/coupons — List all coupons with usage count (Admin only)
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 25, search, status } = req.query;

      const result = await listCoupons({
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
);

// POST /api/coupons — Create coupon (Admin only)
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = couponSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const coupon = await createCoupon(parsed.data);
      logAuditFromReq(req, 'create', 'coupon', coupon.id, {
        code: parsed.data.code,
        type: parsed.data.type,
        value: parsed.data.value,
      });

      res.status(201).json({ success: true, data: coupon });
    } catch (err) {
      if (err instanceof CouponError) {
        return res.status(err.statusCode).json({ success: false, error: err.message });
      }
      next(err);
    }
  }
);

// PUT /api/coupons/:id — Update coupon (Admin only)
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = couponSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const coupon = await updateCoupon(req.params.id, parsed.data);
      logAuditFromReq(req, 'update', 'coupon', req.params.id, {
        code: parsed.data.code,
        type: parsed.data.type,
        value: parsed.data.value,
      });

      res.json({ success: true, data: coupon });
    } catch (err) {
      if (err instanceof CouponError) {
        return res.status(err.statusCode).json({ success: false, error: err.message });
      }
      next(err);
    }
  }
);

// DELETE /api/coupons/:id — Soft delete (set status='inactive') (Admin only)
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteCoupon(req.params.id);
      logAuditFromReq(req, 'delete', 'coupon', req.params.id);
      res.json({ success: true, data: { message: 'Coupon deactivated' } });
    } catch (err) {
      if (err instanceof CouponError) {
        return res.status(err.statusCode).json({ success: false, error: err.message });
      }
      next(err);
    }
  }
);

// POST /api/coupons/validate — Validate a coupon code at checkout
router.post('/validate', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = validateCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const result = await validateCoupon(parsed.data);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof CouponError) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
});

export default router;
