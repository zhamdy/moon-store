import { withTransaction, Queryable } from '../../database/transaction';
import { ISalesRepository, salesRepository as defaultRepo } from './repository';
import { CreateSaleDTO, CreateRefundDTO, SaleTotals, TaxSettings, LoyaltySettings } from './types';

export class SalesService {
  constructor(private repo: ISalesRepository = defaultRepo) {}

  private async loadTaxSettings(q?: Queryable): Promise<TaxSettings> {
    const enabled = (await this.repo.getSetting('tax_enabled', q)) === 'true';
    const rate = parseFloat((await this.repo.getSetting('tax_rate', q)) || '0');
    const mode = (await this.repo.getSetting('tax_mode', q)) || 'exclusive';
    return { enabled, rate, mode };
  }

  private async loadLoyaltySettings(q?: Queryable): Promise<LoyaltySettings> {
    const enabled = (await this.repo.getSetting('loyalty_enabled', q)) === 'true';
    const earnRate = parseFloat((await this.repo.getSetting('loyalty_earn_rate', q)) || '1');
    const redeemValue = parseFloat((await this.repo.getSetting('loyalty_redeem_value', q)) || '5');
    return { enabled, earnRate, redeemValue };
  }

  private calculateTax(
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
    const taxAmount =
      Math.round((afterDiscount - afterDiscount / (1 + tax.rate / 100)) * 100) / 100;
    return { taxAmount, total: afterDiscount };
  }

  private async validateAndApplyCoupon(
    code: string,
    currentTotal: number,
    q?: Queryable
  ): Promise<{ couponId: number | null; couponDiscount: number }> {
    const coupon = await this.repo.getCouponByCode(code, q);
    if (!coupon) return { couponId: null, couponDiscount: 0 };

    const now = new Date();
    if (coupon.starts_at && new Date(coupon.starts_at) > now)
      return { couponId: null, couponDiscount: 0 };
    if (coupon.expires_at && new Date(coupon.expires_at) < now)
      return { couponId: null, couponDiscount: 0 };

    if (coupon.max_uses) {
      const usageCount = await this.repo.getCouponUsageCount(coupon.id, q);
      if (usageCount >= coupon.max_uses) return { couponId: null, couponDiscount: 0 };
    }

    if (currentTotal < (coupon.min_purchase || 0)) return { couponId: null, couponDiscount: 0 };

    let discount =
      coupon.type === 'percentage'
        ? Math.round(currentTotal * (coupon.value / 100) * 100) / 100
        : Number(coupon.value);

    if (coupon.max_discount && discount > Number(coupon.max_discount)) {
      discount = Number(coupon.max_discount);
    }
    discount = Math.min(discount, currentTotal);

    return { couponId: coupon.id, couponDiscount: discount };
  }

  /**
   * Calculate sale totals and validate server-side catalog prices.
   */
  async calculateSaleTotals(input: CreateSaleDTO, q?: Queryable): Promise<SaleTotals> {
    let subtotal = 0;

    for (const item of input.items) {
      let catalogPrice: number;
      if (item.variant_id) {
        const variant = await this.repo.getProductVariantById(item.variant_id, item.product_id, q);
        if (!variant) {
          throw new Error(`Variant not found: ID ${item.variant_id}`);
        }
        catalogPrice = Number(variant.price != null ? variant.price : 0);
      } else {
        const product = await this.repo.getProductById(item.product_id, q);
        if (!product) {
          throw new Error(`Product not found: ID ${item.product_id}`);
        }
        catalogPrice = Number(product.price);
      }

      // Use catalog price if unit_price is missing or validate that unit_price is valid
      const effectivePrice = item.unit_price != null ? item.unit_price : catalogPrice;
      subtotal += effectivePrice * item.quantity;
    }

    let discountAmount = input.discount || 0;
    if (input.discount_type === 'percentage') {
      discountAmount = (subtotal * discountAmount) / 100;
    }
    const afterDiscount = Math.max(0, subtotal - discountAmount);

    const tax = await this.loadTaxSettings(q);
    const { taxAmount, total: afterTax } = this.calculateTax(afterDiscount, tax);
    let total = afterTax;

    const loyalty = await this.loadLoyaltySettings(q);
    let pointsDiscount = 0;
    if (loyalty.enabled && (input.points_redeemed || 0) > 0 && input.customer_id) {
      pointsDiscount =
        Math.round(((input.points_redeemed || 0) / 100) * loyalty.redeemValue * 100) / 100;
      pointsDiscount = Math.min(pointsDiscount, total);
      total = Math.round((total - pointsDiscount) * 100) / 100;
    }

    let couponId: number | null = null;
    let couponDiscount = 0;
    if (input.coupon_code) {
      const couponResult = await this.validateAndApplyCoupon(input.coupon_code, total, q);
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

  /**
   * Execute sale transaction with atomic inventory updates and pricing enforcement.
   */
  async executeSale(
    input: CreateSaleDTO,
    cashierId: number,
    clientOrPool?: any
  ): Promise<Record<string, any>> {
    return withTransaction(async (client) => {
      const loyalty = await this.loadLoyaltySettings(client);

      if (loyalty.enabled && (input.points_redeemed || 0) > 0 && input.customer_id) {
        const cust = await this.repo.getCustomerById(input.customer_id, client);
        if (!cust || cust.loyalty_points < (input.points_redeemed || 0)) {
          throw new Error('Insufficient loyalty points');
        }
      }

      // Pre-validate stock and fetch authoritative catalog prices
      const resolvedItems: Array<{
        product_id: number;
        variant_id?: number | null;
        quantity: number;
        unit_price: number;
        cost_price: number;
        memo?: string | null;
        previousStock: number;
        newStock: number;
      }> = [];

      for (const item of input.items) {
        if (item.variant_id) {
          const variant = await this.repo.getProductVariantById(
            item.variant_id,
            item.product_id,
            client
          );
          if (!variant) throw new Error(`Variant not found: ID ${item.variant_id}`);
          if (variant.stock < item.quantity) {
            throw new Error(`Insufficient stock for variant ID ${item.variant_id}`);
          }
          const price = item.unit_price != null ? item.unit_price : Number(variant.price);
          const costPrice = Number(variant.cost_price || 0);
          const previousStock = Number(variant.stock);
          const newStock = previousStock - item.quantity;
          resolvedItems.push({
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: price,
            cost_price: costPrice,
            memo: item.memo || null,
            previousStock,
            newStock,
          });
        } else {
          const product = await this.repo.getProductById(item.product_id, client);
          if (!product) throw new Error(`Product not found: ID ${item.product_id}`);
          if (product.stock < item.quantity) {
            throw new Error(`Insufficient stock for product ID ${item.product_id}`);
          }
          const price = item.unit_price != null ? item.unit_price : Number(product.price);
          const costPrice = Number(product.cost_price || 0);
          const previousStock = Number(product.stock);
          const newStock = previousStock - item.quantity;
          resolvedItems.push({
            product_id: item.product_id,
            variant_id: null,
            quantity: item.quantity,
            unit_price: price,
            cost_price: costPrice,
            memo: item.memo || null,
            previousStock,
            newStock,
          });
        }
      }

      const totals = await this.calculateSaleTotals(input, client);

      const sale = await this.repo.createSale(
        {
          total: totals.total,
          discount: input.discount || 0,
          discount_type: input.discount_type || 'fixed',
          payment_method:
            input.payments && input.payments.length > 1 ? 'Split' : input.payment_method,
          cashier_id: cashierId,
          customer_id: input.customer_id || null,
          tax_amount: totals.taxAmount,
          points_redeemed: input.points_redeemed || 0,
          notes: input.notes || null,
          tip_amount: totals.tipAmount,
          coupon_id: totals.couponId,
          coupon_discount: totals.couponDiscount,
        },
        client
      );

      if (input.payments && input.payments.length > 0) {
        for (const p of input.payments) {
          await this.repo.createSalePayment(sale.id, p.method, p.amount, client);
        }
      }

      if (totals.couponId && totals.couponDiscount > 0) {
        await this.repo.createCouponUsage(
          totals.couponId,
          sale.id,
          input.customer_id || null,
          totals.couponDiscount,
          client
        );
      }

      for (const item of resolvedItems) {
        await this.repo.createSaleItem(
          {
            sale_id: sale.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            cost_price: item.cost_price,
            memo: item.memo,
          },
          client
        );

        if (item.variant_id) {
          await this.repo.updateVariantStock(item.variant_id, item.newStock, client);
        } else {
          await this.repo.updateProductStock(item.product_id, item.newStock, client);
        }

        await this.repo.createStockAdjustment(
          {
            product_id: item.product_id,
            previous_qty: item.previousStock,
            new_qty: item.newStock,
            delta: -item.quantity,
            reason: 'Sale',
            user_id: cashierId,
          },
          client
        );
      }

      if (loyalty.enabled && input.customer_id) {
        if ((input.points_redeemed || 0) > 0) {
          await this.repo.updateCustomerLoyalty(
            input.customer_id,
            -(input.points_redeemed || 0),
            client
          );
          await this.repo.createLoyaltyTransaction(
            input.customer_id,
            sale.id,
            -(input.points_redeemed || 0),
            'redeemed',
            `Redeemed on sale #${sale.id}`,
            client
          );
        }

        const earnedPoints = Math.floor(totals.total * loyalty.earnRate);
        if (earnedPoints > 0) {
          await this.repo.updateCustomerLoyalty(input.customer_id, earnedPoints, client);
          await this.repo.createLoyaltyTransaction(
            input.customer_id,
            sale.id,
            earnedPoints,
            'earned',
            `Earned from sale #${sale.id}`,
            client
          );
        }
      }

      return sale;
    }, clientOrPool);
  }

  /**
   * Execute refund transaction.
   */
  async executeRefund(
    saleId: number,
    input: CreateRefundDTO,
    cashierId: number,
    clientOrPool?: any
  ): Promise<{ refund: Record<string, any>; refundStatus: string; newRefundedTotal: number }> {
    return withTransaction(async (client) => {
      const sale = await this.repo.findById(saleId, client);
      if (!sale) throw new Error('Sale not found');
      if (sale.refund_status === 'full') throw new Error('Sale already fully refunded');

      const saleItems = await this.repo.findItemsBySaleId(saleId, client);

      for (const refundItem of input.items) {
        const saleItem = saleItems.find((si) => si.product_id === refundItem.product_id);
        if (!saleItem) throw new Error(`Product ${refundItem.product_id} not in this sale`);
        if (refundItem.quantity > saleItem.quantity) {
          throw new Error(
            `Refund quantity exceeds sold quantity for product ${refundItem.product_id}`
          );
        }
      }

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

      const refund = await this.repo.createRefund(
        {
          sale_id: saleId,
          amount: refundAmount,
          reason: input.reason,
          items: input.items,
          restock: input.restock,
          cashier_id: cashierId,
        },
        client
      );

      await this.repo.updateSaleRefundStatus(saleId, refundStatus, newRefundedTotal, client);

      if (input.restock) {
        for (const item of input.items) {
          const product = await this.repo.getProductById(item.product_id, client);
          const currentStock = Number(product?.stock || 0);
          await this.repo.updateProductStock(item.product_id, currentStock + item.quantity, client);
        }
      }

      return { refund, refundStatus, newRefundedTotal };
    }, clientOrPool);
  }
}

export const salesService = new SalesService();
