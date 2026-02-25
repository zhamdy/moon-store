import db from '../db';

// --- Types ---

export interface CouponFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface CouponListResult {
  coupons: Record<string, any>[];
  total: number;
  page: number;
  limit: number;
}

export interface CouponData {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase?: number | null;
  max_discount?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  max_uses_per_customer?: number | null;
  scope: 'all' | 'category' | 'product';
  scope_ids?: number[] | null;
  stackable: boolean;
}

export interface ValidateCouponInput {
  code: string;
  subtotal: number;
  customer_id?: number | null;
  item_product_ids?: number[] | null;
}

export interface ValidateCouponResult {
  coupon_id: number;
  code: string;
  type: string;
  value: number;
  discount: number;
  stackable: boolean;
}

export class CouponError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'CouponError';
  }
}

// --- Helpers ---

function parseScopeIds(row: Record<string, any>): Record<string, any> {
  return {
    ...row,
    scope_ids: row.scope_ids ? JSON.parse(row.scope_ids) : null,
  };
}

function validatePercentage(type: string, value: number): void {
  if (type === 'percentage' && value > 100) {
    throw new CouponError('Percentage value cannot exceed 100', 400);
  }
}

function buildCouponParams(data: CouponData): unknown[] {
  return [
    data.code,
    data.type,
    data.value,
    data.min_purchase ?? null,
    data.max_discount ?? null,
    data.starts_at ?? null,
    data.expires_at ?? null,
    data.max_uses ?? null,
    data.max_uses_per_customer ?? null,
    data.scope,
    data.scope_ids ? JSON.stringify(data.scope_ids) : null,
    data.stackable ? 1 : 0,
  ];
}

// --- Public API ---

export async function listCoupons(filters: CouponFilters): Promise<CouponListResult> {
  const pageNum = filters.page || 1;
  const limitNum = filters.limit || 25;
  const offset = (pageNum - 1) * limitNum;

  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    where.push(`c.code LIKE ?`);
    params.push(`%${filters.search}%`);
  }
  if (filters.status) {
    where.push(`c.status = ?`);
    params.push(filters.status);
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
  const coupons = result.rows.map((row: any) => parseScopeIds(row));

  return { coupons, total, page: pageNum, limit: limitNum };
}

export async function createCoupon(data: CouponData): Promise<Record<string, any>> {
  validatePercentage(data.type, data.value);

  try {
    const result = await db.query(
      `INSERT INTO coupons (code, type, value, min_purchase, max_discount, starts_at, expires_at, max_uses, max_uses_per_customer, scope, scope_ids, stackable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      buildCouponParams(data)
    );

    const coupon = result.rows[0] as Record<string, any>;
    return parseScopeIds(coupon);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      throw new CouponError('Coupon code already exists', 409);
    }
    throw err;
  }
}

export async function updateCoupon(
  id: string | number,
  data: CouponData
): Promise<Record<string, any>> {
  validatePercentage(data.type, data.value);

  try {
    const result = await db.query(
      `UPDATE coupons SET code=?, type=?, value=?, min_purchase=?, max_discount=?, starts_at=?, expires_at=?, max_uses=?, max_uses_per_customer=?, scope=?, scope_ids=?, stackable=?
       WHERE id=? AND status='active' RETURNING *`,
      [...buildCouponParams(data), id]
    );

    if (result.rows.length === 0) {
      throw new CouponError('Coupon not found or already inactive', 404);
    }

    const coupon = result.rows[0] as Record<string, any>;
    return parseScopeIds(coupon);
  } catch (err: any) {
    if (err instanceof CouponError) throw err;
    if (err.message?.includes('UNIQUE')) {
      throw new CouponError('Coupon code already exists', 409);
    }
    throw err;
  }
}

export async function deleteCoupon(id: string | number): Promise<void> {
  const result = await db.query(`UPDATE coupons SET status='inactive' WHERE id=? RETURNING id`, [
    id,
  ]);

  if (result.rows.length === 0) {
    throw new CouponError('Coupon not found', 404);
  }
}

export async function validateCoupon(input: ValidateCouponInput): Promise<ValidateCouponResult> {
  const { code, subtotal, customer_id, item_product_ids } = input;

  // Step 1: Look up the coupon
  const couponResult = await db.query(
    `SELECT * FROM coupons WHERE code = ? AND status = 'active'`,
    [code.toUpperCase().trim()]
  );

  if (couponResult.rows.length === 0) {
    throw new CouponError('Coupon not found or inactive', 404);
  }

  const coupon = couponResult.rows[0] as Record<string, any>;
  const now = new Date().toISOString();

  // Step 2: Check start date
  if (coupon.starts_at && now < coupon.starts_at) {
    throw new CouponError('Coupon is not yet active', 400);
  }

  // Step 3: Check expiry
  if (coupon.expires_at && now > coupon.expires_at) {
    throw new CouponError('Coupon has expired', 400);
  }

  // Step 4: Check minimum purchase
  if (coupon.min_purchase && subtotal < coupon.min_purchase) {
    throw new CouponError(`Minimum purchase of ${coupon.min_purchase} required`, 400);
  }

  // Step 5: Check global usage limit
  if (coupon.max_uses) {
    const usageResult = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ?`,
      [coupon.id]
    );
    if (usageResult.rows[0].count >= coupon.max_uses) {
      throw new CouponError('Coupon usage limit reached', 400);
    }
  }

  // Step 6: Check per-customer usage limit
  if (coupon.max_uses_per_customer && customer_id) {
    const customerUsageResult = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ? AND customer_id = ?`,
      [coupon.id, customer_id]
    );
    if (customerUsageResult.rows[0].count >= coupon.max_uses_per_customer) {
      throw new CouponError('Coupon usage limit reached for this customer', 400);
    }
  }

  // Step 7: Check scope
  if (coupon.scope === 'category' || coupon.scope === 'product') {
    const scopeIds: number[] = coupon.scope_ids ? JSON.parse(coupon.scope_ids) : [];

    if (scopeIds.length > 0 && item_product_ids && item_product_ids.length > 0) {
      if (coupon.scope === 'product') {
        // At least one product in cart must match scope
        const hasMatch = item_product_ids.some((pid: number) => scopeIds.includes(pid));
        if (!hasMatch) {
          throw new CouponError('Coupon does not apply to any products in the cart', 400);
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
          throw new CouponError('Coupon does not apply to any product categories in the cart', 400);
        }
      }
    }
  }

  // Step 8: Calculate discount
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

  return {
    coupon_id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
    stackable: !!coupon.stackable,
  };
}
