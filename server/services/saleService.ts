import db from '../src/database/pool';
import { withTransaction, Queryable } from '../src/database/transaction';

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

export interface SaleTotals {
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

async function loadSetting(queryable: Queryable, key: string): Promise<string | undefined> {
  const result = await queryable.query<{ value: string }>('SELECT value FROM settings WHERE key = $1', [key]);
  return result.rows[0]?.value;
}

async function loadTaxSettings(queryable: Queryable): Promise<TaxSettings> {
  const enabled = (await loadSetting(queryable, 'tax_enabled')) === 'true';
  const rate = parseFloat((await loadSetting(queryable, 'tax_rate')) || '0');
  const mode = (await loadSetting(queryable, 'tax_mode')) || 'exclusive';
  return { enabled, rate, mode };
}

async function loadLoyaltySettings(queryable: Queryable): Promise<LoyaltySettings> {
  const enabled = (await loadSetting(queryable, 'loyalty_enabled')) === 'true';
  const earnRate = parseFloat((await loadSetting(queryable, 'loyalty_earn_rate')) || '1');
  const redeemValue = parseFloat((await loadSetting(queryable, 'loyalty_redeem_value')) || '5');
  return { enabled, earnRate, redeemValue };
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

async function validateAndApplyCoupon(
  queryable: Queryable,
  code: string,
  currentTotal: number
): Promise<{ couponId: number | null; couponDiscount: number }> {
  const result = await queryable.query<Record<string, any>>(
    "SELECT * FROM coupons WHERE code = $1 AND status = 'active'",
    [code]
  );
  const coupon = result.rows[0];

  if (!coupon) return { couponId: null, couponDiscount: 0 };

  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { couponId: null, couponDiscount: 0 };
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return { couponId: null, couponDiscount: 0 };

  if (coupon.max_uses) {
    const usage = await queryable.query<{ c: number }>(
      'SELECT COUNT(*)::int as c FROM coupon_usage WHERE coupon_id = $1',
      [coupon.id]
    );
    if ((usage.rows[0]?.c || 0) >= coupon.max_uses) return { couponId: null, couponDiscount: 0 };
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

export async function calculateSaleTotals(
  input: CreateSaleInput,
  queryable: Queryable = db
): Promise<SaleTotals> {
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
  const tax = await loadTaxSettings(queryable);
  const { taxAmount, total: afterTax } = calculateTax(afterDiscount, tax);
  let total = afterTax;

  // Loyalty points redemption
  const loyalty = await loadLoyaltySettings(queryable);
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
    const couponResult = await validateAndApplyCoupon(queryable, input.coupon_code, total);
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

export async function executeSaleTransaction(
  input: CreateSaleInput,
  totals: SaleTotals,
  cashierId: number,
  clientOrPool?: any
): Promise<Record<string, any>> {
  return withTransaction(async (client) => {
    const loyalty = await loadLoyaltySettings(client);

    // Validate customer has enough points
    if (loyalty.enabled && (input.points_redeemed || 0) > 0 && input.customer_id) {
      const custRes = await client.query<{ loyalty_points: number }>(
        'SELECT loyalty_points FROM customers WHERE id = $1',
        [input.customer_id]
      );
      const cust = custRes.rows[0];
      if (!cust || cust.loyalty_points < (input.points_redeemed || 0)) {
        throw new Error('Insufficient loyalty points');
      }
    }

    // Pre-validate stock for all items to fail fast
    for (const item of input.items) {
      if (item.variant_id) {
        const variantRes = await client.query<{ stock: number }>(
          'SELECT stock FROM product_variants WHERE id = $1 AND product_id = $2',
          [item.variant_id, item.product_id]
        );
        const variant = variantRes.rows[0];
        if (!variant) {
          throw new Error(`Variant not found: ID ${item.variant_id}`);
        }
        if (variant.stock < item.quantity) {
          throw new Error(`Insufficient stock for variant ID ${item.variant_id}`);
        }
      } else {
        const prodRes = await client.query<{ stock: number }>(
          'SELECT stock FROM products WHERE id = $1',
          [item.product_id]
        );
        const product = prodRes.rows[0];
        if (!product) {
          throw new Error(`Product not found: ID ${item.product_id}`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for product ID ${item.product_id}`);
        }
      }
    }

    // Insert sale
    const saleResult = await client.query<Record<string, any>>(
      `INSERT INTO sales (
        total, discount, discount_type, payment_method, cashier_id, customer_id,
        tax_amount, points_redeemed, notes, tip_amount, coupon_id, coupon_discount
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
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
        totals.couponDiscount,
      ]
    );
    const sale = saleResult.rows[0];

    // Split payments
    if (input.payments && input.payments.length > 0) {
      for (const p of input.payments) {
        await client.query(
          'INSERT INTO sale_payments (sale_id, method, amount) VALUES ($1, $2, $3)',
          [sale.id, p.method, p.amount]
        );
      }
    }

    // Coupon usage
    if (totals.couponId && totals.couponDiscount > 0) {
      await client.query(
        'INSERT INTO coupon_usage (coupon_id, sale_id, customer_id, discount_applied) VALUES ($1, $2, $3, $4)',
        [totals.couponId, sale.id, input.customer_id || null, totals.couponDiscount]
      );
    }

    // Process items: deduct stock, record sale items
    for (const item of input.items) {
      const variantId = item.variant_id || null;
      const itemMemo = item.memo || null;

      if (variantId) {
        const variantRes = await client.query<{ cost_price: number; stock: number }>(
          'SELECT cost_price, stock FROM product_variants WHERE id = $1 AND product_id = $2',
          [variantId, item.product_id]
        );
        const variant = variantRes.rows[0];
        const costPrice = variant.cost_price || 0;
        const previousStock = variant.stock || 0;
        const newStock = previousStock - item.quantity;

        await client.query(
          'INSERT INTO sale_items (sale_id, product_id, variant_id, quantity, unit_price, cost_price, memo) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [sale.id, item.product_id, variantId, item.quantity, item.unit_price, costPrice, itemMemo]
        );

        await client.query(
          'UPDATE product_variants SET stock = $1, updated_at = NOW() WHERE id = $2',
          [newStock, variantId]
        );

        await client.query(
          'INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [item.product_id, previousStock, newStock, -item.quantity, 'Sale', cashierId]
        );
      } else {
        const prodRes = await client.query<{ cost_price: number; stock: number }>(
          'SELECT cost_price, stock FROM products WHERE id = $1',
          [item.product_id]
        );
        const product = prodRes.rows[0];
        const costPrice = product.cost_price || 0;
        const previousStock = product.stock || 0;
        const newStock = previousStock - item.quantity;

        await client.query(
          'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price, memo) VALUES ($1, $2, $3, $4, $5, $6)',
          [sale.id, item.product_id, item.quantity, item.unit_price, costPrice, itemMemo]
        );

        await client.query(
          'UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2',
          [newStock, item.product_id]
        );

        await client.query(
          'INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [item.product_id, previousStock, newStock, -item.quantity, 'Sale', cashierId]
        );
      }
    }

    // Loyalty points: deduct redeemed, earn new
    if (loyalty.enabled && input.customer_id) {
      if ((input.points_redeemed || 0) > 0) {
        await client.query(
          'UPDATE customers SET loyalty_points = loyalty_points - $1, updated_at = NOW() WHERE id = $2',
          [input.points_redeemed, input.customer_id]
        );
        await client.query(
          'INSERT INTO loyalty_transactions (customer_id, sale_id, points, type, note) VALUES ($1, $2, $3, $4, $5)',
          [input.customer_id, sale.id, -(input.points_redeemed || 0), 'redeemed', `Redeemed on sale #${sale.id}`]
        );
      }

      const earnedPoints = Math.floor(totals.total * loyalty.earnRate);
      if (earnedPoints > 0) {
        await client.query(
          'UPDATE customers SET loyalty_points = loyalty_points + $1, updated_at = NOW() WHERE id = $2',
          [earnedPoints, input.customer_id]
        );
        await client.query(
          'INSERT INTO loyalty_transactions (customer_id, sale_id, points, type, note) VALUES ($1, $2, $3, $4, $5)',
          [input.customer_id, sale.id, earnedPoints, 'earned', `Earned from sale #${sale.id}`]
        );
      }
    }

    return sale;
  }, clientOrPool);
}

export interface RefundInput {
  items: Array<{ product_id: number; quantity: number; unit_price: number }>;
  reason: string;
  restock: boolean;
}

export async function executeRefundTransaction(
  saleId: number,
  input: RefundInput,
  cashierId: number,
  clientOrPool?: any
): Promise<{ refund: Record<string, any>; refundStatus: string; newRefundedTotal: number }> {
  return withTransaction(async (client) => {
    // Verify sale
    const saleRes = await client.query<{ id: number; total: number; refunded_amount: number | null; refund_status: string | null }>(
      'SELECT id, total, refunded_amount, refund_status FROM sales WHERE id = $1',
      [saleId]
    );
    const sale = saleRes.rows[0];

    if (!sale) throw new Error('Sale not found');
    if (sale.refund_status === 'full') throw new Error('Sale already fully refunded');

    // Validate items against sale
    const itemsRes = await client.query<{ product_id: number; quantity: number; unit_price: number }>(
      'SELECT product_id, quantity, unit_price FROM sale_items WHERE sale_id = $1',
      [saleId]
    );
    const saleItems = itemsRes.rows;

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

    const previouslyRefunded = Number(sale.refunded_amount) || 0;
    if (previouslyRefunded + refundAmount > Number(sale.total)) {
      throw new Error('Refund amount exceeds sale total');
    }

    const newRefundedTotal = previouslyRefunded + refundAmount;
    const refundStatus = newRefundedTotal >= Number(sale.total) ? 'full' : 'partial';

    const refundRes = await client.query<Record<string, any>>(
      `INSERT INTO refunds (sale_id, amount, reason, items, restock, cashier_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [saleId, refundAmount, input.reason, JSON.stringify(input.items), input.restock ? 1 : 0, cashierId]
    );
    const refund = refundRes.rows[0];

    await client.query(
      'UPDATE sales SET refund_status = $1, refunded_amount = $2 WHERE id = $3',
      [refundStatus, newRefundedTotal, saleId]
    );

    if (input.restock) {
      for (const item of input.items) {
        const prodRes = await client.query<{ stock: number }>(
          'SELECT stock FROM products WHERE id = $1',
          [item.product_id]
        );
        const currentStock = prodRes.rows[0]?.stock || 0;
        await client.query(
          'UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2',
          [currentStock + item.quantity, item.product_id]
        );
      }
    }

    return { refund, refundStatus, newRefundedTotal };
  }, clientOrPool);
}
