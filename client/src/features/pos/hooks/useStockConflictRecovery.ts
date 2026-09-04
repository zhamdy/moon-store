/**
 * The recovery half of a rejected checkout: say what no longer fits, and offer
 * the one action that makes the cart sellable again.
 *
 * Two ways in. `adopt` takes the shortfalls the server stated in its rejection
 * — the normal path, instant, and the only one that can speak for a variant
 * line. `check` re-reads stock and works them out, for a rejection that named
 * no stock detail but might still have been about the cart.
 *
 * Deliberately explicit rather than automatic. The cart is money the cashier
 * has already agreed with a customer standing in front of them; silently
 * dropping a line would be worse than the generic failure it replaces. So this
 * hook only ever *proposes* — `resolve()` runs when the cashier presses the
 * button, never on its own.
 */
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTransport } from '../../../shared/lib/transport/index';
import type { Product } from '../../../shared/types/index';
import {
  checkableProductIds,
  findStockShortfalls,
  planCartAdjustment,
  type StockShortfall,
} from '../lib/stockConflict';
import { useCartStore } from '../store/cartStore';

export interface StockConflictRecovery {
  shortfalls: StockShortfall[];
  isChecking: boolean;
  /** Show the shortfalls the server already named. No request. */
  adopt: (shortfalls: StockShortfall[]) => void;
  /** Re-read stock for the cart and work out what no longer fits. */
  check: () => void;
  /** Apply the proposal: trim oversold lines, drop the ones with nothing left. */
  resolve: () => void;
  /** Forget the proposal, e.g. once the cashier has edited the cart by hand. */
  clear: () => void;
}

export function useStockConflictRecovery(): StockConflictRecovery {
  const transport = useTransport();
  const queryClient = useQueryClient();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const [shortfalls, setShortfalls] = useState<StockShortfall[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const adopt = useCallback(
    (next: StockShortfall[]) => {
      setShortfalls(next);
      // The POS grid is showing stock the server has just contradicted.
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    [queryClient]
  );

  const check = useCallback(() => {
    const ids = checkableProductIds(useCartStore.getState().items);
    if (ids.length === 0) {
      setShortfalls([]);
      return;
    }

    setIsChecking(true);
    void transport
      .request<Product[]>({
        method: 'GET',
        path: 'products/lookup',
        params: { ids: ids.join(',') },
      })
      .then(({ data }) => {
        const fresh = new Map(data.map((product) => [product.id, Number(product.stock)]));
        setShortfalls(findStockShortfalls(useCartStore.getState().items, fresh));
        // The POS grid is showing the same numbers this call just corrected.
        queryClient.invalidateQueries({ queryKey: ['products'] });
      })
      .catch(() => {
        // The check is a courtesy on top of a failure the cashier has already
        // been told about. If it cannot run there is nothing further to say --
        // surfacing a second error here would only bury the first.
        setShortfalls([]);
      })
      .finally(() => setIsChecking(false));
  }, [transport, queryClient]);

  const resolve = useCallback(() => {
    for (const adjustment of planCartAdjustment(items, shortfalls)) {
      if (adjustment.quantity === 0) removeItem(adjustment.productId, adjustment.variantId);
      else updateQuantity(adjustment.productId, adjustment.quantity, adjustment.variantId);
    }
    setShortfalls([]);
  }, [items, shortfalls, removeItem, updateQuantity]);

  const clear = useCallback(() => setShortfalls([]), []);

  return { shortfalls, isChecking, adopt, check, resolve, clear };
}
