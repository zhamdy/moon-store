import { toast } from 'sonner';

/**
 * The one way the storefront raises a toast (owner decision 2026-09-15: every info and error
 * message in the bag, product and filter flows is a toast). Client-bundled without a
 * directive: only client islands import it. Pure modules import the types only.
 */

export type ToastTone = 'success' | 'info' | 'error';

/** Errors stay longer: they usually ask for an action. Sonner pauses on hover and focus. */
export const TOAST_DURATION_MS: Readonly<Record<ToastTone, number>> = {
  success: 4000,
  info: 4000,
  error: 7000,
};

export interface ShowToastInput {
  tone: ToastTone;
  message: string;
  /** A stable id replaces the toast already showing under it instead of stacking a second. */
  id?: string;
  action?: { label: string; onClick(): void };
}

export function showToast({ tone, message, id, action }: ShowToastInput): void {
  toast[tone](message, {
    id,
    duration: TOAST_DURATION_MS[tone],
    action: action ? { label: action.label, onClick: () => action.onClick() } : undefined,
  });
}

export function dismissToast(id: string): void {
  toast.dismiss(id);
}
