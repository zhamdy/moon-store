import type { toast, Toaster } from 'sonner';
import { createToastQueue, createToasterGate, memoizeLoader } from './toast-queue';

/**
 * The one way the storefront raises a toast (owner decision 2026-09-15: every info and error
 * message in the bag, product and filter flows is a toast). Client-bundled without a
 * directive: only client islands import it. Pure modules import the types only.
 *
 * Sonner is lazy (owner decision 2026-09-15): nothing here or in `app-toaster.tsx` imports it
 * statically. `loadSonner` is the one `import('sonner')`, so the toast state and the
 * `Toaster` are one module instance. A call before the toaster has mounted is queued and
 * requests it; the queue flushes once the live region exists (see `toast-queue.ts`).
 */

export interface SonnerModule {
  toast: typeof toast;
  Toaster: typeof Toaster;
}

export const loadSonner = memoizeLoader<SonnerModule>(() => import('sonner'));

export const toasterGate = createToasterGate();

const queue = createToastQueue<SonnerModule>({
  load: loadSonner,
  whenReady: () => {
    toasterGate.request();
    return toasterGate.whenReady();
  },
  isReady: toasterGate.isReady,
});

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
  queue.run(({ toast }) => {
    toast[tone](message, {
      id,
      duration: TOAST_DURATION_MS[tone],
      action: action ? { label: action.label, onClick: () => action.onClick() } : undefined,
    });
  });
}

export function dismissToast(id: string): void {
  queue.run(({ toast }) => {
    toast.dismiss(id);
  });
}
