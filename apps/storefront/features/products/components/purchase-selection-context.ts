import { createContext, useContext } from 'react';
import type { PurchaseReadiness } from '../utils/variant-selection';

/**
 * The purchase panel's selection, read by the action the page composes into its `action`
 * slot (CD-11). Not a client boundary: no `'use client'`, so this module is only ever
 * evaluated inside the client graph of the files that import it (`purchase-panel.tsx` and
 * the action island), which share one context instance. A Server Component must never
 * import it; `createContext` does not exist in the react-server build.
 */
export interface PurchaseSelection {
  readiness: PurchaseReadiness;
  /** The exact unit price of the ready selection, else null; a display hint, never a total. */
  unitPrice: number | null;
  /** Focuses the first unselected option group and announces "Choose a {option}". */
  focusFirstUnselected(): void;
}

export const PurchaseSelectionContext = createContext<PurchaseSelection | null>(null);

export function usePurchaseSelection(): PurchaseSelection {
  const selection = useContext(PurchaseSelectionContext);
  if (!selection) {
    throw new Error('usePurchaseSelection must be rendered inside the PurchasePanel action slot');
  }
  return selection;
}
