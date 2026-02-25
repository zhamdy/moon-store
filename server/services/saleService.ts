import db from '../db';
import type Database from 'better-sqlite3';

// --- Types ---

interface SaleItem {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price: number;
  memo?: string | null;
}

interface Payment {
  method: string;
  amount: number;
}

export interface CreateSaleInput {
  items: SaleItem[];
  discount: number;
  discount_type: string;
  payment_method: string;
  payments?: Payment[];
  customer_id?: number | null;
  points_redeemed?: number;
  notes?: string | null;
  tip?: number;
  coupon_code?: string | null;
}

interface TaxSettings {
  enabled: boolean;
  rate: number;
  mode: string;
}

interface LoyaltySettings {
  enabled: boolean;
  earnRate: number;
  redeemValue: number;
}

interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  taxAmount: number;
  pointsDiscount: number;
  couponId: number | null;
  couponDiscount: number;
  tipAmount: number;
  total: number;
}

// --- Helpers ---

function loadSetting(rawDb: Database.Database, key: string): string | undefined {
  const row = rawDb.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

function loadTaxSettings(rawDb: Database.Database): TaxSettings {
  return {
    enabled: loadSetting(rawDb, 'tax_enabled') === 'true',
    rate: parseFloat(loadSetting(rawDb, 'tax_rate') || '0'),
    mode: loadSetting(rawDb, 'tax_mode') || 'exclusive',
  };
}

function loadLoyaltySettings(rawDb: Database.Database): LoyaltySettings {
  return {
    enabled: loadSetting(rawDb, 'loyalty_enabled') === 'true',
    earnRate: parseFloat(loadSetting(rawDb, 'loyalty_earn_rate') || '1'),
    redeemValue: parseFloat(loadSetting(rawDb, 'loyalty_redeem_value') || '5'),
  };
}

function calculateTax(
  afterDiscount: number,
  tax: TaxSettings
): { taxAmount: number; total: number } {
  if (!tax.enabled || tax.rate <= 0) {
    return { taxAmount: 0, total: afterDiscount };
  }
  if (tax.mode === 'exclusive') {
    const taxAmount = Math.round(afterDiscount * (tax.rate / 100) * 100) / 100;
    return { taxAmount, total: afterDiscount + taxAmount };
  }
  // inclusive
  const taxAmount = Math.round((afterDiscount - afterDiscount / (1 + tax.rate / 100)) * 100) / 100;
  return { taxAmount, total: afterDiscount };
}

function validateAndApplyCoupon(
  rawDb: Database.Database,
  code: string,
  currentTotal: number
): { couponId: number | null; couponDiscount: number } {
  const coupon = rawDb
    .prepare("SELECT * FROM coupons WHERE code = ? AND status = 'active'")
    .get(code) as Record<string, any> | undefined;

  if (!coupon) return { couponId: null, couponDiscount: 0 };

  const now = new Date().toISOString();
  if (coupon.starts_at && coupon.starts_at > now) return { couponId: null, couponDiscount: 0 };
  if (coupon.expires_at && coupon.expires_at < now) return { couponId: null, couponDiscount: 0 };

  if (coupon.max_uses) {
    const usage = rawDb
      .prepare('SELECT COUNT(*) as c FROM coupon_usage WHERE coupon_id = ?')
      .get(coupon.id) as { c: number };
    if (usage.c >= coupon.max_uses) return { couponId: null, couponDiscount: 0 };
  }

  if (currentTotal < (coupon.min_purchase || 0)) return { couponId: null, couponDiscount: 0 };

  let discount =
    coupon.type === 'percentage'
      ? Math.round(currentTotal * (coupon.value / 100) * 100) / 100
      : coupon.value;

  if (coupon.max_discount && discount > coupon.max_discount) discount = coupon.max_discount;
  discount = Math.min(discount, currentTotal);

  return { couponId: coupon.id, couponDiscount: discount };
}

// --- Public API ---

export function calculateSaleTotals(input: CreateSaleInput): SaleTotals {
  const rawDb = db.db;

  // Subtotal
  let subtotal = 0;
  for (const item of input.items) {
    subtotal += item.unit_price * item.quantity;
  }

  // Discount
  let discountAmount = input.discount;
  if (input.discount_type === 'percentage') {
    discountAmount = (subtotal * input.discount) / 100;
  }
  const afterDiscount = Math.max(0, subtotal - discountAmount);

  // Tax
  const tax = loadTaxSettings(rawDb);
  const { taxAmount, total: afterTax } = calculateTax(afterDiscount, tax);
  let total = afterTax;

  // Loyalty points redemption
  const loyalty = loadLoyaltySettings(rawDb);
  let pointsDiscount = 0;
  if (loyalty.enabled && (input.points_redeemed || 0) > 0 && input.customer_id) {
    pointsDiscount =
      Math.round(((input.points_redeemed || 0) / 100) * loyalty.redeemValue * 100) / 100;
    pointsDiscount = Math.min(pointsDiscount, total);
    total = Math.round((total - pointsDiscount) * 100) / 100;
  }

  // Coupon
  let couponId: number | null = null;
  let couponDiscount = 0;
  if (input.coupon_code) {
    const couponResult = validateAndApplyCoupon(rawDb, input.coupon_code, total);
    couponId = couponResult.couponId;
    couponDiscount = couponResult.couponDiscount;
    total = Math.round((total - couponDiscount) * 100) / 100;
  }

  return {
    subtotal,
    discountAmount,
    afterDiscount,
    taxAmount,
    pointsDiscount,
    couponId,
    couponDiscount,
    tipAmount: input.tip || 0,
    total,
  };
}

export function executeSaleTransaction(
  input: CreateSaleInput,
  totals: SaleTotals,
  cashierId: number
): Record<string, any> {
  const rawDb = db.db;
  const loyalty = loadLoyaltySettings(rawDb);

  const txn = rawDb.transaction(() => {
    // Validate customer has enough points
    if (loyalty.enabled && (input.points_redeemed || 0) > 0 && input.customer_id) {
      const cust = rawDb
        .prepare('SELECT loyalty_points FROM customers WHERE id = ?')
        .get(input.customer_id) as { loyalty_points: number } | undefined;
      if (!cust || cust.loyalty_points < (input.points_redeemed || 0)) {
        throw new Error('Insufficient loyalty points');
      }
    }

    // Insert sale
    const saleResult = rawDb
      .prepare(
        `INSERT INTO sales (total, discount, discount_type, payment_method, cashier_id, customer_id, tax_amount, points_redeemed, notes, tip_amount, coupon_id, coupon_discount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(
        totals.total,
        input.discount,
        input.discount_type,
        input.payments && input.payments.length > 1 ? 'Split' : input.payment_method,
        cashierId,
        input.customer_id || null,
        totals.taxAmount,
        input.points_redeemed || 0,
        input.notes || null,
        totals.tipAmount,
        totals.couponId,
        totals.couponDiscount
      ) as Record<string, any>;

    // Split payments
    if (input.payments && input.payments.length > 0) {
      const insertPayment = rawDb.prepare(
        'INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)'
      );
      for (const p of input.payments) {
        insertPayment.run(saleResult.id, p.method, p.amount);
      }
    }

    // Coupon usage
    if (totals.couponId && totals.couponDiscount > 0) {
      rawDb
        .prepare(
          'INSERT INTO coupon_usage (coupon_id, sale_id, customer_id, discount_applied) VALUES (?, ?, ?, ?)'
        )
        .run(totals.couponId, saleResult.id, input.customer_id || null, totals.couponDiscount);
    }

    // Process items: deduct stock, record sale items
    for (const item of input.items) {
      const variantId = item.variant_id || null;
      const itemMemo = item.memo || null;

      if (variantId) {
        const variant = rawDb
          .prepare('SELECT cost_price, stock FROM product_variants WHERE id = ? AND product_id = ?')
          .get(variantId, item.product_id) as { cost_price: number; stock: number } | undefined;
        const costPrice = variant?.cost_price || 0;
        const previousStock = variant?.stock || 0;

        rawDb
          .prepare(
            'INSERT INTO sale_items (sale_id, product_id, variant_id, quantity, unit_price, cost_price, memo) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .run(
            saleResult.id,
            item.product_id,
            variantId,
            item.quantity,
            item.unit_price,
            costPrice,
            itemMemo
          );

        const updated = rawDb
          .prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
          .run(item.quantity, variantId, item.quantity);
        if (updated.changes === 0) {
          throw new Error(`Insufficient stock for variant ID ${variantId}`);
        }

        rawDb
          .prepare(
            'INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(
            item.product_id,
            previousStock,
            previousStock - item.quantity,
            -item.quantity,
            'Sale',
            cashierId
          );
      } else {
        const product = rawDb
          .prepare('SELECT cost_price, stock FROM products WHERE id = ?')
          .get(item.product_id) as { cost_price: number; stock: number } | undefined;
        const costPrice = product?.cost_price || 0;
        const previousStock = product?.stock || 0;

        rawDb
          .prepare(
            'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price, memo) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(saleResult.id, item.product_id, item.quantity, item.unit_price, costPrice, itemMemo);

        const updated = rawDb
          .prepare(
            "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND stock >= ?"
          )
          .run(item.quantity, item.product_id, item.quantity);
        if (updated.changes === 0) {
          throw new Error(`Insufficient stock for product ID ${item.product_id}`);
        }

        rawDb
          .prepare(
            'INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(
            item.product_id,
            previousStock,
            previousStock - item.quantity,
            -item.quantity,
            'Sale',
            cashierId
          );
      }
    }

    // Loyalty points: deduct redeemed, earn new
    if (loyalty.enabled && input.customer_id) {
      if ((input.points_redeemed || 0) > 0) {
        rawDb
          .prepare(
            "UPDATE customers SET loyalty_points = loyalty_points - ?, updated_at = datetime('now') WHERE id = ?"
          )
          .run(input.points_redeemed, input.customer_id);
        rawDb
          .prepare(
            'INSERT INTO loyalty_transactions (customer_id, sale_id, points, type, note) VALUES (?, ?, ?, ?, ?)'
          )
          .run(
            input.customer_id,
            saleResult.id,
            -(input.points_redeemed || 0),
            'redeemed',
            `Redeemed on sale #${saleResult.id}`
          );
      }

      const earnedPoints = Math.floor(totals.total * loyalty.earnRate);
      if (earnedPoints > 0) {
        rawDb
          .prepare(
            "UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = datetime('now') WHERE id = ?"
          )
          .run(earnedPoints, input.customer_id);
        rawDb
          .prepare(
            'INSERT INTO loyalty_transactions (customer_id, sale_id, points, type, note) VALUES (?, ?, ?, ?, ?)'
          )
          .run(
            input.customer_id,
            saleResult.id,
            earnedPoints,
            'earned',
            `Earned from sale #${saleResult.id}`
          );
      }
    }

    return saleResult;
  });

  return txn();
}

export interface RefundInput {
  items: Array<{ product_id: number; quantity: number; unit_price: number }>;
  reason: string;
  restock: boolean;
}

export function executeRefundTransaction(
  saleId: number,
  input: RefundInput,
  cashierId: number
): { refund: Record<string, any>; refundStatus: string; newRefundedTotal: number } {
  const rawDb = db.db;

  // Verify sale
  const sale = rawDb
    .prepare('SELECT id, total, refunded_amount, refund_status FROM sales WHERE id = ?')
    .get(saleId) as
    | { id: number; total: number; refunded_amount: number | null; refund_status: string | null }
    | undefined;

  if (!sale) throw new Error('Sale not found');
  if (sale.refund_status === 'full') throw new Error('Sale already fully refunded');

  // Validate items against sale
  const saleItems = rawDb
    .prepare('SELECT product_id, quantity, unit_price FROM sale_items WHERE sale_id = ?')
    .all(saleId) as Array<{ product_id: number; quantity: number; unit_price: number }>;

  for (const refundItem of input.items) {
    const saleItem = saleItems.find((si) => si.product_id === refundItem.product_id);
    if (!saleItem) throw new Error(`Product ${refundItem.product_id} not in this sale`);
    if (refundItem.quantity > saleItem.quantity) {
      throw new Error(`Refund quantity exceeds sold quantity for product ${refundItem.product_id}`);
    }
  }

  // Calculate refund amount
  let refundAmount = 0;
  for (const item of input.items) {
    refundAmount += item.unit_price * item.quantity;
  }

  const previouslyRefunded = sale.refunded_amount || 0;
  if (previouslyRefunded + refundAmount > sale.total) {
    throw new Error('Refund amount exceeds sale total');
  }

  const newRefundedTotal = previouslyRefunded + refundAmount;
  const refundStatus = newRefundedTotal >= sale.total ? 'full' : 'partial';

  const txn = rawDb.transaction(() => {
    const refund = rawDb
      .prepare(
        `INSERT INTO refunds (sale_id, amount, reason, items, restock, cashier_id)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(
        saleId,
        refundAmount,
        input.reason,
        JSON.stringify(input.items),
        input.restock ? 1 : 0,
        cashierId
      ) as Record<string, any>;

    rawDb
      .prepare('UPDATE sales SET refund_status = ?, refunded_amount = ? WHERE id = ?')
      .run(refundStatus, newRefundedTotal, saleId);

    if (input.restock) {
      for (const item of input.items) {
        rawDb
          .prepare(
            "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?"
          )
          .run(item.quantity, item.product_id);
      }
    }

    return refund;
  });

  const refund = txn();
  return { refund, refundStatus, newRefundedTotal };
}
