import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { ICouponsRepository, couponsRepository as defaultRepo } from './repository';
import {
  CouponData,
  CouponError,
  CouponFilters,
  CouponListResult,
  UpdateCouponData,
  ValidateCouponInput,
  ValidateCouponResult,
} from './types';

export class CouponsService {
  constructor(private repo: ICouponsRepository = defaultRepo) {}

  getRepository(): ICouponsRepository {
    return this.repo;
  }

  private validatePercentage(type: string, value: number): void {
    if (type === 'percentage' && value > 100) {
      throw new CouponError('Percentage value cannot exceed 100', 400);
    }
  }

  async list(filters: CouponFilters): Promise<CouponListResult> {
    return this.repo.list(filters);
  }

  async findById(id: number | string): Promise<Record<string, any> | null> {
    return this.repo.findById(id);
  }

  async create(data: CouponData): Promise<Record<string, any>> {
    this.validatePercentage(data.type, data.value);

    try {
      return await this.repo.create(data);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        throw new CouponError('Coupon code already exists', 409);
      }
      throw err;
    }
  }

  /**
   * A partial update is validated against the *effective* coupon, not against the body.
   *
   * Raising `value` to 150 without re-sending `type` would otherwise skip the percentage
   * ceiling entirely, because the body's `type` is absent. The rule belongs to the row the
   * update produces, so the check reads the stored row for whatever the body left out.
   */
  async update(id: string | number, data: UpdateCouponData): Promise<Record<string, any>> {
    if (data.type !== undefined || data.value !== undefined) {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new CouponError('Coupon not found or already inactive', 404);
      }
      this.validatePercentage(data.type ?? existing.type, data.value ?? Number(existing.value));
    }

    try {
      const coupon = await this.repo.update(id, data);
      if (!coupon) {
        throw new CouponError('Coupon not found or already inactive', 404);
      }
      return coupon;
    } catch (err: any) {
      if (err instanceof CouponError) throw err;
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        throw new CouponError('Coupon code already exists', 409);
      }
      throw err;
    }
  }

  async delete(id: string | number): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) {
      throw new CouponError('Coupon not found', 404);
    }
  }

  /**
   * Validate a coupon against the canonical eligibility/scope/limit rules.
   * Accepts an optional transaction-scoped `queryable` (see
   * `server/src/database/transaction.ts`) so callers such as
   * `SalesService.executeSale` can run this validation inside the checkout
   * transaction instead of maintaining a weaker, parallel coupon lookup.
   *
   * `forConsumption` marks the path that is about to record a `coupon_usage` row. It
   * locks the coupon before counting usage, which is what makes `max_uses` hold under
   * concurrency: without it, N concurrent checkouts all read the same count and all pass.
   * The preview paths (`calculateSaleTotals`, the standalone validate endpoint) leave it
   * false and take no lock — a preview that blocked a checkout would be a self-inflicted
   * contention source.
   */
  async validate(
    input: ValidateCouponInput,
    queryable: Queryable = pool,
    options: { forConsumption?: boolean } = {}
  ): Promise<ValidateCouponResult> {
    const { code, subtotal, customer_id, item_product_ids } = input;

    const coupon = options.forConsumption
      ? await this.repo.findByCodeForUpdate(code, queryable)
      : await this.repo.findByCode(code, queryable);
    if (!coupon) {
      throw new CouponError('Coupon not found or inactive', 404);
    }

    const now = new Date();

    if (coupon.starts_at && now < new Date(coupon.starts_at)) {
      throw new CouponError('Coupon is not yet active', 400);
    }

    if (coupon.expires_at && now > new Date(coupon.expires_at)) {
      throw new CouponError('Coupon has expired', 400);
    }

    if (coupon.min_purchase && subtotal < Number(coupon.min_purchase)) {
      throw new CouponError(`Minimum purchase of ${coupon.min_purchase} required`, 400);
    }

    if (coupon.max_uses) {
      const usageCount = await this.repo.getUsageCount(coupon.id, queryable);
      if (usageCount >= coupon.max_uses) {
        throw new CouponError('Coupon usage limit reached', 400);
      }
    }

    if (coupon.max_uses_per_customer && customer_id) {
      const customerUsageCount = await this.repo.getCustomerUsageCount(
        coupon.id,
        customer_id,
        queryable
      );
      if (customerUsageCount >= coupon.max_uses_per_customer) {
        throw new CouponError('Coupon usage limit reached for this customer', 400);
      }
    }

    if (coupon.scope === 'category' || coupon.scope === 'product') {
      const scopeIds: number[] = coupon.scope_ids
        ? typeof coupon.scope_ids === 'string'
          ? JSON.parse(coupon.scope_ids)
          : coupon.scope_ids
        : [];

      if (scopeIds.length > 0 && item_product_ids && item_product_ids.length > 0) {
        if (coupon.scope === 'product') {
          const hasMatch = item_product_ids.some((pid: number) => scopeIds.includes(pid));
          if (!hasMatch) {
            throw new CouponError('Coupon does not apply to any products in the cart', 400);
          }
        } else if (coupon.scope === 'category') {
          const matchCount = await this.repo.checkProductCategoriesMatch(
            item_product_ids,
            scopeIds,
            queryable
          );
          if (matchCount === 0) {
            throw new CouponError(
              'Coupon does not apply to any product categories in the cart',
              400
            );
          }
        }
      }
    }

    let discount: number;
    if (coupon.type === 'percentage') {
      discount = Math.round(((subtotal * Number(coupon.value)) / 100) * 100) / 100;
    } else {
      discount = Math.min(Number(coupon.value), subtotal);
    }

    if (coupon.max_discount && discount > Number(coupon.max_discount)) {
      discount = Number(coupon.max_discount);
    }

    discount = Math.min(discount, subtotal);

    return {
      coupon_id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discount,
      stackable: !!coupon.stackable,
    };
  }
}

export const couponsService = new CouponsService();
