import { withTransaction, Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { ISalesRepository, salesRepository as defaultRepo } from './repository';
import { CreateSaleDTO, SaleTotals, TaxSettings, LoyaltySettings, CreateRefundDTO } from './types';

export class SalesService {
  constructor(private repo: ISalesRepository = defaultRepo) {}

  getRepository(): ISalesRepository {
    return this.repo;
  }

  async getTaxSettings(queryable: Queryable = pool): Promise<TaxSettings> {
    const taxEnabledStr = await this.repo.getSetting('tax_enabled', queryable);
    const taxRateStr = await this.repo.getSetting('tax_rate', queryable);
    const taxModeStr = await this.repo.getSetting('tax_mode', queryable);

    return {
      enabled: taxEnabledStr === 'true',
      rate: Number(taxRateStr || 0),
      mode: taxModeStr || 'inclusive',
    };
  }

  async getLoyaltySettings(queryable: Queryable = pool): Promise<LoyaltySettings> {
    const loyaltyEnabledStr = await this.repo.getSetting('loyalty_enabled', queryable);
    const earnRateStr = await this.repo.getSetting('loyalty_earn_rate', queryable);
    const redeemValueStr = await this.repo.getSetting('loyalty_redeem_value', queryable);

    return {
      enabled: loyaltyEnabledStr === 'true',
      earnRate: Number(earnRateStr || 0.05),
      redeemValue: Number(redeemValueStr || 0.1),
    };
  }

  async calculateSaleTotals(
    input: CreateSaleDTO,
    queryable: Queryable = pool
  ): Promise<SaleTotals> {
    let subtotal = 0;
    for (const item of input.items) {
      if (item.unit_price != null) {
        subtotal += item.unit_price * item.quantity;
      } else if (item.variant_id) {
        const variant = await this.repo.getProductVariantById(
          item.variant_id,
          item.product_id,
          queryable
        );
        if (!variant) throw new Error(`Variant not found: ID ${item.variant_id}`);
        subtotal += Number(variant.price) * item.quantity;
      } else {
        const product = await this.repo.getProductById(item.product_id, queryable);
        if (!product) throw new Error(`Product not found: ID ${item.product_id}`);
        subtotal += Number(product.price) * item.quantity;
      }
    }

    let discountAmount = 0;
    if (input.discount && input.discount > 0) {
      if (input.discount_type === 'percentage') {
        discountAmount = (subtotal * Math.min(input.discount, 100)) / 100;
      } else {
        discountAmount = Math.min(input.discount, subtotal);
      }
    }

    const afterDiscount = subtotal - discountAmount;

    let couponDiscount = 0;
    let couponId: number | null = null;
    if (input.coupon_code) {
      const coupon = await this.repo.getCouponByCode(
        input.coupon_code.toUpperCase().trim(),
        queryable
      );
      if (coupon) {
        const now = new Date();
        const startValid = !coupon.starts_at || new Date(coupon.starts_at) <= now;
        const endValid = !coupon.expires_at || new Date(coupon.expires_at) >= now;
        const minValid = !coupon.min_purchase || afterDiscount >= Number(coupon.min_purchase);

        const usageCount = await this.repo.getCouponUsageCount(coupon.id, queryable);
        const maxValid = !coupon.max_uses || usageCount < Number(coupon.max_uses);

        if (startValid && endValid && minValid && maxValid) {
          couponId = coupon.id;
          if (coupon.type === 'percentage') {
            couponDiscount = (afterDiscount * Number(coupon.value)) / 100;
            if (coupon.max_discount) {
              couponDiscount = Math.min(couponDiscount, Number(coupon.max_discount));
            }
          } else {
            couponDiscount = Math.min(Number(coupon.value), afterDiscount);
          }
        }
      }
    }

    const loyalty = await this.getLoyaltySettings(queryable);
    let pointsDiscount = 0;
    if (loyalty.enabled && (input.points_redeemed || 0) > 0 && input.customer_id) {
      pointsDiscount = (input.points_redeemed || 0) * loyalty.redeemValue;
    }

    const tax = await this.getTaxSettings(queryable);
    let taxAmount = 0;
    let taxableBase = afterDiscount - couponDiscount - pointsDiscount;
    taxableBase = Math.max(0, taxableBase);

    if (tax.enabled && tax.rate > 0) {
      if (tax.mode === 'exclusive') {
        taxAmount = (taxableBase * tax.rate) / 100;
      } else {
        taxAmount = taxableBase - taxableBase / (1 + tax.rate / 100);
      }
    }

    const tipAmount = input.tip || 0;
    let total =
      tax.mode === 'exclusive' ? taxableBase + taxAmount + tipAmount : taxableBase + tipAmount;

    total = Math.max(0, Math.round(total * 100) / 100);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      afterDiscount: Math.round(afterDiscount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      pointsDiscount: Math.round(pointsDiscount * 100) / 100,
      couponId,
      couponDiscount: Math.round(couponDiscount * 100) / 100,
      tipAmount: Math.round(tipAmount * 100) / 100,
      total,
    };
  }

  async executeSale(
    input: CreateSaleDTO,
    cashierId: number,
    clientOrPool?: any
  ): Promise<Record<string, any>> {
    return withTransaction(async (client) => {
      const loyalty = await this.getLoyaltySettings(client);

      if (loyalty.enabled && (input.points_redeemed || 0) > 0 && input.customer_id) {
        const cust = await this.repo.getCustomerById(input.customer_id, client);
        if (!cust || cust.loyalty_points < (input.points_redeemed || 0)) {
          throw new Error('Insufficient loyalty points');
        }
      }

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
