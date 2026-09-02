/**
 * Applying and removing a coupon.
 *
 * The discount is never computed here: the cashier's code is sent to
 * `POST /api/v1/coupons/validate` and the server answers with the resolved
 * amount, which is what lands in the cart store. Extracted from CartPanel
 * (issue #51); behaviour unchanged.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../shared/i18n/index';
import { useTransport } from '../../../shared/lib/transport/index';
import { useCartStore } from '../store/cartStore';
import type { CouponValidation } from '../types';

export interface CouponApplication {
  input: string;
  setInput: (value: string) => void;
  apply: () => Promise<void>;
  remove: () => void;
}

export function useCouponApplication(params: {
  /** The authoritative subtotal the coupon is validated against. */
  subtotal: number;
  productIds: number[];
  customerId?: number | null;
}): CouponApplication {
  const { subtotal, productIds, customerId } = params;
  const setCoupon = useCartStore((s) => s.setCoupon);
  const clearCoupon = useCartStore((s) => s.clearCoupon);
  const transport = useTransport();
  const { t } = useTranslation();

  const [input, setInput] = useState('');

  return {
    input,
    setInput,
    apply: async () => {
      if (!input.trim()) return;
      try {
        const { data } = await transport.request<CouponValidation>({
          method: 'POST',
          path: 'coupons/validate',
          body: {
            code: input.trim(),
            // The authoritative subtotal, the same figure every displayed line
            // uses. This used to be `cartStore.getSubtotal()`, a second
            // float-arithmetic derivation of it.
            subtotal,
            ...(customerId ? { customer_id: customerId } : {}),
            item_product_ids: productIds,
          },
        });
        setCoupon(data.code, data.discount);
        toast.success(t('cart.couponApplied'));
      } catch (err: unknown) {
        toast.error((err as Error).message || t('cart.couponInvalid'));
      }
    },
    remove: () => {
      clearCoupon();
      setInput('');
    },
  };
}
