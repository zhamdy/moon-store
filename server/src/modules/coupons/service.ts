import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  CouponError,
} from '../../../services/couponService';
import { ICouponsRepository, couponsRepository as defaultRepo } from './repository';
import { CouponFilters, CreateCouponDTO, ValidateCouponDTO } from './types';

export { CouponError };

export class CouponsService {
  constructor(private repo: ICouponsRepository = defaultRepo) {}

  getRepository(): ICouponsRepository {
    return this.repo;
  }

  listCoupons(filters: CouponFilters) {
    return listCoupons(filters);
  }

  createCoupon(data: CreateCouponDTO) {
    return createCoupon(data);
  }

  updateCoupon(id: string | number, data: CreateCouponDTO) {
    return updateCoupon(id, data);
  }

  deleteCoupon(id: string | number) {
    return deleteCoupon(id);
  }

  validateCoupon(input: ValidateCouponDTO) {
    return validateCoupon(input);
  }
}

export const couponsService = new CouponsService();
