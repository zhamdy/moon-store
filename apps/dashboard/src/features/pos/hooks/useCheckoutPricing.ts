/**
 * The one place a checkout's money is decided.
 *
 * Everything the cashier sees — the cart footer's total, the checkout drawer's
 * breakdown, the customer-facing display, the split-tender balance and the
 * loyalty redemption cap — reads from this hook's single `totals` object, which
 * is `shared/lib/checkout`'s `calculateTotals` applied once per render. Nothing
 * else in the POS may derive a total of its own: that is exactly the class of
 * bug the canonical calculation contract exists to prevent (the cart footer
 * once added tax but ignored points and tip while the drawer subtracted both).
 *
 * It also owns the loyalty *redemption* state (the toggle and the point count)
 * because that state is meaningless apart from the cap it is clamped to, and a
 * second owner would let a stale point count outlive the change that shrank it.
 *
 * Extracted from CartPanel (issue #51) so checkout calculation can be tested
 * without rendering the POS screen.
 */
import { useEffect, useMemo, useState } from 'react';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import {
  calculateTotals,
  allocateSplit,
  maxRedeemablePoints,
  type Allocation,
  type TaxSettings,
  type Totals,
} from '../../../shared/lib/checkout';
import type { AppSettings } from '../../../shared/types/index';
import { readTaxPolicy, readLoyaltyPolicy, type LoyaltyPolicy } from '../lib/checkoutSettings';
import { useCartStore } from '../store/cartStore';
import type { PaymentEntry } from '../types';

interface CustomerLoyalty {
  points: number;
}

export interface LoyaltyState extends LoyaltyPolicy {
  /** The selected customer's current balance; 0 when nobody is selected. */
  customerPoints: number;
}

export interface CheckoutPricing {
  /** The settings row, exposed for callers that need more than tax/loyalty. */
  appSettings?: AppSettings;
  tax: TaxSettings;
  loyalty: LoyaltyState;
  /** The authoritative breakdown. Every displayed figure comes from here. */
  totals: Totals;
  /** Split-tender allocation against `totals.amountDue`. */
  split: Allocation;
  /** The most this customer may redeem on this sale. */
  maxPoints: number;
  redeemPoints: boolean;
  pointsToRedeem: number;
  setRedeemPoints: (on: boolean) => void;
  setPointsToRedeem: (points: number) => void;
  /** Forget the redemption entirely — used when the customer or the sale goes away. */
  resetRedemption: () => void;
}

export function useCheckoutPricing(params: {
  /** The selected customer, or null for a walk-in. */
  customerId?: number | null;
  /** The split tenders the cashier has entered, if any. */
  payments: PaymentEntry[];
}): CheckoutPricing {
  const { customerId, payments } = params;

  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);
  const discountType = useCartStore((s) => s.discountType);
  const couponDiscount = useCartStore((s) => s.couponDiscount);
  const tip = useCartStore((s) => s.tip);

  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Shared cache key: `features/admin/pages/Settings.tsx` and
  // `features/customers/components/CustomerDetail.tsx` read and invalidate the
  // same settings resource under this key. Intentional sharing, not a
  // collision — see docs/CONVENTIONS.md, "Global string-coupling contract".
  const { data: appSettings } = useApiQuery<AppSettings>(['settings'], 'settings', undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const loyaltyPolicy = useMemo(() => readLoyaltyPolicy(appSettings), [appSettings]);
  const tax = useMemo(() => readTaxPolicy(appSettings), [appSettings]);

  const { data: customerLoyalty } = useApiQuery<CustomerLoyalty>(
    ['customer-loyalty', customerId],
    `customers/${customerId}/loyalty`,
    undefined,
    {
      enabled: !!customerId && loyaltyPolicy.enabled,
      staleTime: 30 * 1000,
    }
  );

  const loyalty = useMemo<LoyaltyState>(
    () => ({ ...loyaltyPolicy, customerPoints: customerLoyalty?.points || 0 }),
    [loyaltyPolicy, customerLoyalty]
  );

  const totals = useMemo(
    () =>
      calculateTotals({
        items,
        discount,
        discountType,
        couponDiscount,
        tax,
        pointsToRedeem: redeemPoints && loyalty.enabled ? pointsToRedeem : 0,
        redeemValue: loyalty.egpPerPoint,
        pointsBalance: loyalty.customerPoints,
        tip,
        loyaltyEnabled: loyalty.enabled,
        pointsPerEgp: loyalty.pointsPerEgp,
      }),
    [items, discount, discountType, couponDiscount, tax, redeemPoints, pointsToRedeem, loyalty, tip]
  );

  // The most the selected customer may redeem on THIS sale: never more than
  // their balance, and never more value than the sale (before loyalty) is
  // worth. `netOfDiscounts + pointsDiscount` recovers the remaining value
  // after manual discount/coupon but BEFORE loyalty, regardless of how many
  // points are currently requested (see checkout.ts's calculation order).
  const maxPoints = useMemo(
    () =>
      maxRedeemablePoints(
        loyalty.customerPoints,
        totals.netOfDiscounts + totals.pointsDiscount,
        loyalty.egpPerPoint
      ),
    [loyalty, totals.netOfDiscounts, totals.pointsDiscount]
  );

  // A stale redeemed-points value must never silently outlive the subtotal,
  // coupon, or tax change that shrank how much can actually be redeemed.
  useEffect(() => {
    if (pointsToRedeem > maxPoints) {
      setPointsToRedeem(maxPoints);
    }
  }, [maxPoints, pointsToRedeem]);

  const split = useMemo(() => allocateSplit(payments, totals.amountDue), [payments, totals]);

  return {
    appSettings,
    tax,
    loyalty,
    totals,
    split,
    maxPoints,
    redeemPoints,
    pointsToRedeem,
    setRedeemPoints,
    setPointsToRedeem,
    resetRedemption: () => {
      setRedeemPoints(false);
      setPointsToRedeem(0);
    },
  };
}
