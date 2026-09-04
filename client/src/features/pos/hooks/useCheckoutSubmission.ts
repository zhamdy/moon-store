/**
 * The submission half of a checkout: composing the request, keying it so a
 * retry cannot double-charge, and deciding what happens to the cart, the
 * receipt and the offline queue once the server answers (or doesn't).
 *
 * Extracted from CartPanel (issue #51) so the submission lifecycle can be
 * exercised without rendering the POS screen. Behaviour is unchanged, including
 * the offline fallback below — which is currently UNREACHABLE from the
 * checkout path (React Query pauses rather than fails a mutation fired while
 * `navigator.onLine` is false, so `onError` never runs). That is issue #53's
 * territory; the fallback is preserved here exactly as it was, not deleted as
 * dead code and not wired up.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../shared/i18n/index';
import { SPLIT_PAYMENT_MISMATCH_CODE, type TaxSettings } from '../../../shared/lib/checkout';
import { useTransport, createIdempotencyKey } from '../../../shared/lib/transport/index';
import { hasDetailCode } from '../../../shared/lib/mutationError';
import { useGuardedMutation } from '../../../shared/lib/useGuardedMutation';
import { useOfflineStore, SALE_QUEUE_CONTRACT_VERSION } from '../../../shared/store/offlineStore';
import type { ReceiptData } from '../../../shared/components/Receipt';
import {
  buildSalePayload,
  buildOfflineSalePayload,
  type SaleComposition,
} from '../lib/salePayload';
import { buildReceipt } from '../lib/saleReceipt';
import { shortfallsFromDetails } from '../lib/stockConflict';
import { useCartStore } from '../store/cartStore';
import { useStockConflictRecovery, type StockConflictRecovery } from './useStockConflictRecovery';
import type { CheckoutAttempt, SaleData, SaleResponse } from '../types';

/**
 * What one attempt carries: the composed body, its idempotency key, and the
 * composition it came from. The composition rides along so the offline
 * fallback queues the sale that was ACTUALLY attempted under that key, rather
 * than re-reading a cart that may have moved on.
 */
type CheckoutMutationVariables = CheckoutAttempt & { composition: SaleComposition };

export interface CheckoutSubmission {
  /**
   * Compose, key and post the sale the cashier just confirmed.
   *
   * A second call while one is in flight is dropped by `useGuardedMutation`,
   * so a double-pressed Confirm (or a held keyboard shortcut) cannot open two
   * concurrent checkouts. That is separate from, and in front of, the
   * idempotency key below: the key makes a duplicate that DOES reach the
   * server harmless, this stops it being sent at all.
   */
  submit: (composition: SaleComposition) => void;
  isPending: boolean;
  /**
   * What the cart would have to become for the sale to go through, after a
   * rejection whose cause was stock. Empty at every other time.
   */
  stockConflict: StockConflictRecovery;
  receiptOpen: boolean;
  setReceiptOpen: (open: boolean) => void;
  receiptData: ReceiptData | null;
}

export function useCheckoutSubmission(params: {
  tax: TaxSettings;
  /** Printed on the receipt; the cart supplies nothing monetary. */
  customerName?: string;
  /**
   * Reset the surrounding checkout UI — close the drawer, drop the selected
   * customer, forget the redemption. Called once a sale is COMMITTED or
   * QUEUED, never after a failure the cashier is expected to retry.
   */
  onCheckoutSettled: () => void;
}): CheckoutSubmission {
  const { tax, customerName, onCheckoutSettled } = params;

  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);
  const discountType = useCartStore((s) => s.discountType);
  const couponCode = useCartStore((s) => s.couponCode);
  const clearCart = useCartStore((s) => s.clearCart);
  const checkoutAttempt = useCartStore((s) => s.checkoutAttempt);
  const setCheckoutAttempt = useCartStore((s) => s.setCheckoutAttempt);
  const addToQueue = useOfflineStore((s) => s.addToQueue);

  const queryClient = useQueryClient();
  const transport = useTransport();
  const { t } = useTranslation();

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  /**
   * The idempotency key identifies one rung-up sale, not one HTTP request. It is keyed on
   * the composed payload so a cashier who hits Confirm again after a failure retries under
   * the SAME key (letting the server return the original outcome rather than committing a
   * second sale), while a cart that has changed gets a fresh one. Cleared once a sale is
   * committed or queued, so the next sale never inherits a key — even an identical repeat
   * order.
   *
   * It lives in the persisted cart store rather than a ref: the cart survives a reload, so
   * the key protecting it has to as well. A till that refreshes while a checkout is in
   * flight would otherwise mint a new key and ring the same sale up twice.
   */
  const idempotencyKeyFor = (saleData: SaleData): string => {
    const fingerprint = JSON.stringify(saleData);
    if (checkoutAttempt?.fingerprint === fingerprint) {
      return checkoutAttempt.key;
    }
    const attempt = { fingerprint, key: createIdempotencyKey() };
    setCheckoutAttempt(attempt);
    return attempt.key;
  };

  const stockConflict = useStockConflictRecovery();

  const checkoutMutation = useGuardedMutation<CheckoutMutationVariables, { data: SaleResponse }>({
    mutationFn: ({ saleData, idempotencyKey }: CheckoutMutationVariables) =>
      transport.request<SaleResponse>({
        method: 'POST',
        path: 'sales',
        body: saleData,
        idempotencyKey,
      }),
    onSuccess: (response) => {
      setCheckoutAttempt(null);

      // Built from the cart as it stands right now -- captured before
      // `clearCart()` below empties it. See saleReceipt.ts: every monetary
      // figure comes from the server's confirmed response; the cart supplies
      // display names only.
      const newReceipt = buildReceipt(response.data, {
        cartItems: items,
        discount,
        discountType,
        couponCode,
        tax,
        customerName,
      });

      toast.success(t('cart.saleSuccess'));
      clearCart();
      onCheckoutSettled();
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty'] });

      setReceiptData(newReceipt);
      setReceiptOpen(true);
    },
    onFailure: (failure, attempt: CheckoutMutationVariables) => {
      if (!navigator.onLine) {
        addToQueue({
          type: 'sale',
          payload: buildOfflineSalePayload(attempt.composition) as unknown as Record<
            string,
            unknown
          >,
          // Stamps this entry as composed under the current (corrected)
          // checkout contract, so useOffline.ts's replay never quarantines
          // it. A legacy entry already sitting in a user's queue from before
          // this deploy has no such field and is left for manual review.
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
          // The same key the failed POST carried: if that request did reach
          // the server after all, the replay is recognised as a duplicate
          // instead of ringing the sale up twice.
          idempotencyKey: attempt.idempotencyKey,
        });
        toast.success(t('cart.savedOffline'));
        setCheckoutAttempt(null);
        clearCart();
        onCheckoutSettled();
        // The queue entry IS the outcome the cashier was told about; the
        // failure that produced it is not theirs to act on.
        return true;
      }

      // Authoritative data (catalog price, tax, coupon, or loyalty
      // settings) changed between preview and submission and the split no
      // longer balances against the server's recalculated total. The cart
      // is intentionally left untouched (nothing cleared or closed above) so
      // the cashier can review and rebalance rather than seeing a generic
      // failure or a false success.
      if (hasDetailCode(failure, SPLIT_PAYMENT_MISMATCH_CODE)) {
        toast.error(t('cart.splitMismatchError'));
        return true;
      }

      // A stock refusal now says so outright, one detail per oversold line with
      // the product, the variant and the two numbers. Showing it costs nothing
      // and is the only path that can speak for a variant line, whose stock the
      // client cannot look up.
      const stated = shortfallsFromDetails(failure.details, useCartStore.getState().items);
      if (stated.length > 0) {
        stockConflict.adopt(stated);
      } else if (failure.recovery === 'fix' || failure.recovery === 'review') {
        // No stock detail. The rejection may still have been about the cart --
        // a coupon, loyalty or bundle failure reads the same from here -- so
        // fall back to re-reading stock and comparing. The toast still fires:
        // this check is asynchronous and additive, not a replacement for
        // telling the cashier immediately that the sale did not go through.
        stockConflict.check();
      }
      // `saleFailed` only stands in when the server said nothing of its own;
      // the classifier already prefers the server's wording where there is any.
      if (!failure.serverMessage) {
        toast.error(t('cart.saleFailed'));
        return true;
      }
      return false;
    },
  });

  return {
    submit: (composition: SaleComposition) => {
      const saleData = buildSalePayload(composition);
      checkoutMutation.submit({
        saleData,
        idempotencyKey: idempotencyKeyFor(saleData),
        composition,
      });
    },
    isPending: checkoutMutation.isPending,
    stockConflict,
    receiptOpen,
    setReceiptOpen,
    receiptData,
  };
}
