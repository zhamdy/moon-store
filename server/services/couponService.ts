import {
  couponsService,
  CouponFilters,
  CouponListResult,
  CouponData,
  ValidateCouponInput,
  ValidateCouponResult,
  CouponError,
} from '../src/modules/commerce/coupons';

export {
  CouponFilters,
  CouponListResult,
  CouponData,
  ValidateCouponInput,
  ValidateCouponResult,
  CouponError,
};

export async function listCoupons(filters: CouponFilters): Promise<CouponListResult> {
  return couponsService.list(filters);
}

export async function createCoupon(data: CouponData): Promise<Record<string, any>> {
  return couponsService.create(data);
}

export async function updateCoupon(
  id: string | number,
  data: CouponData
): Promise<Record<string, any>> {
  return couponsService.update(id, data);
}

export async function deleteCoupon(id: string | number): Promise<void> {
  return couponsService.delete(id);
}

export async function validateCoupon(input: ValidateCouponInput): Promise<ValidateCouponResult> {
  return couponsService.validate(input);
}
