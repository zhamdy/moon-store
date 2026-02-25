import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';

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
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const where: string[] = [];
      const params: unknown[] = [];

      if (search) {
        where.push(`c.code LIKE ?`);
        params.push(`%${search}%`);
      }
      if (status) {
        where.push(`c.status = ?`);
        params.push(status);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM coupons c ${whereClause}`,
        params
      );
      const total = countResult.rows[0].count;

      const result = await db.query(
        `SELECT c.*,
                (SELECT COUNT(*) FROM coupon_usage cu WHERE cu.coupon_id = c.id) as usage_count
         FROM coupons c
         ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      // Parse scope_ids JSON
      const coupons = result.rows.map((row: any) => ({
        ...row,
        scope_ids: row.scope_ids ? JSON.parse(row.scope_ids) : null,
      }));

      res.json({
        success: true,
        data: coupons,
        meta: { total, page: pageNum, limit: limitNum },
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

      const {
        code,
        type,
        value,
        min_purchase,
        max_discount,
        starts_at,
        expires_at,
        max_uses,
        max_uses_per_customer,
        scope,
        scope_ids,
        stackable,
      } = parsed.data;

      // Validate percentage is <= 100
      if (type === 'percentage' && value > 100) {
        return res
          .status(400)
          .json({ success: false, error: 'Percentage value cannot exceed 100' });
      }

      const result = await db.query(
        `INSERT INTO coupons (code, type, value, min_purchase, max_discount, starts_at, expires_at, max_uses, max_uses_per_customer, scope, scope_ids, stackable)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        [
          code,
          type,
          value,
          min_purchase ?? null,
          max_discount ?? null,
          starts_at ?? null,
          expires_at ?? null,
          max_uses ?? null,
          max_uses_per_customer ?? null,
          scope,
          scope_ids ? JSON.stringify(scope_ids) : null,
          stackable ? 1 : 0,
        ]
      );

      const coupon = result.rows[0] as Record<string, any>;
      logAuditFromReq(req, 'create', 'coupon', coupon.id, { code, type, value });

      res.status(201).json({
        success: true,
        data: {
          ...coupon,
          scope_ids: coupon.scope_ids ? JSON.parse(coupon.scope_ids) : null,
        },
      });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return res.status(409).json({ success: false, error: 'Coupon code already exists' });
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

      const {
        code,
        type,
        value,
        min_purchase,
        max_discount,
        starts_at,
        expires_at,
        max_uses,
        max_uses_per_customer,
        scope,
        scope_ids,
        stackable,
      } = parsed.data;

      // Validate percentage is <= 100
      if (type === 'percentage' && value > 100) {
        return res
          .status(400)
          .json({ success: false, error: 'Percentage value cannot exceed 100' });
      }

      const result = await db.query(
        `UPDATE coupons SET code=?, type=?, value=?, min_purchase=?, max_discount=?, starts_at=?, expires_at=?, max_uses=?, max_uses_per_customer=?, scope=?, scope_ids=?, stackable=?
         WHERE id=? AND status='active' RETURNING *`,
        [
          code,
          type,
          value,
          min_purchase ?? null,
          max_discount ?? null,
          starts_at ?? null,
          expires_at ?? null,
          max_uses ?? null,
          max_uses_per_customer ?? null,
          scope,
          scope_ids ? JSON.stringify(scope_ids) : null,
          stackable ? 1 : 0,
          req.params.id,
        ]
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: 'Coupon not found or already inactive' });
      }

      const coupon = result.rows[0] as Record<string, any>;
      logAuditFromReq(req, 'update', 'coupon', req.params.id, { code, type, value });

      res.json({
        success: true,
        data: {
          ...coupon,
          scope_ids: coupon.scope_ids ? JSON.parse(coupon.scope_ids) : null,
        },
      });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return res.status(409).json({ success: false, error: 'Coupon code already exists' });
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
      const result = await db.query(
        `UPDATE coupons SET status='inactive' WHERE id=? RETURNING id`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Coupon not found' });
      }

      logAuditFromReq(req, 'delete', 'coupon', req.params.id);
      res.json({ success: true, data: { message: 'Coupon deactivated' } });
    } catch (err) {
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

    const { code, subtotal, customer_id, item_product_ids } = parsed.data;

    // Look up the coupon
    const couponResult = await db.query(
      `SELECT * FROM coupons WHERE code = ? AND status = 'active'`,
      [code.toUpperCase().trim()]
    );

    if (couponResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Coupon not found or inactive' });
    }

    const coupon = couponResult.rows[0] as Record<string, any>;
    const now = new Date().toISOString();

    // Check start date
    if (coupon.starts_at && now < coupon.starts_at) {
      return res.status(400).json({ success: false, error: 'Coupon is not yet active' });
    }

    // Check expiry
    if (coupon.expires_at && now > coupon.expires_at) {
      return res.status(400).json({ success: false, error: 'Coupon has expired' });
    }

    // Check minimum purchase
    if (coupon.min_purchase && subtotal < coupon.min_purchase) {
      return res.status(400).json({
        success: false,
        error: `Minimum purchase of ${coupon.min_purchase} required`,
      });
    }

    // Check global usage limit
    if (coupon.max_uses) {
      const usageResult = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ?`,
        [coupon.id]
      );
      if (usageResult.rows[0].count >= coupon.max_uses) {
        return res.status(400).json({ success: false, error: 'Coupon usage limit reached' });
      }
    }

    // Check per-customer usage limit
    if (coupon.max_uses_per_customer && customer_id) {
      const customerUsageResult = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ? AND customer_id = ?`,
        [coupon.id, customer_id]
      );
      if (customerUsageResult.rows[0].count >= coupon.max_uses_per_customer) {
        return res.status(400).json({
          success: false,
          error: 'Coupon usage limit reached for this customer',
        });
      }
    }

    // Check scope
    if (coupon.scope === 'category' || coupon.scope === 'product') {
      const scopeIds: number[] = coupon.scope_ids ? JSON.parse(coupon.scope_ids) : [];

      if (scopeIds.length > 0 && item_product_ids && item_product_ids.length > 0) {
        if (coupon.scope === 'product') {
          // At least one product in cart must match scope
          const hasMatch = item_product_ids.some((pid: number) => scopeIds.includes(pid));
          if (!hasMatch) {
            return res.status(400).json({
              success: false,
              error: 'Coupon does not apply to any products in the cart',
            });
          }
        } else if (coupon.scope === 'category') {
          // Check if any cart product belongs to a scoped category
          const placeholders = item_product_ids.map(() => '?').join(',');
          const catPlaceholders = scopeIds.map(() => '?').join(',');
          const matchResult = await db.query<{ count: number }>(
            `SELECT COUNT(*) as count FROM products
               WHERE id IN (${placeholders}) AND category_id IN (${catPlaceholders})`,
            [...item_product_ids, ...scopeIds]
          );
          if (matchResult.rows[0].count === 0) {
            return res.status(400).json({
              success: false,
              error: 'Coupon does not apply to any product categories in the cart',
            });
          }
        }
      }
    }

    // Calculate discount
    let discount: number;
    if (coupon.type === 'percentage') {
      discount = Math.round(((subtotal * coupon.value) / 100) * 100) / 100;
    } else {
      // fixed
      discount = Math.min(coupon.value, subtotal);
    }

    // Apply max_discount cap
    if (coupon.max_discount && discount > coupon.max_discount) {
      discount = coupon.max_discount;
    }

    // Ensure discount does not exceed subtotal
    discount = Math.min(discount, subtotal);

    res.json({
      success: true,
      data: {
        coupon_id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount,
        stackable: !!coupon.stackable,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
