export interface ShareCapableNavigator {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
  clipboard?: { writeText?: (text: string) => Promise<void> };
}

export type ShareAction = 'share' | 'copy' | 'none';

/**
 * What the share button does on this device: the native sheet when the Web Share API
 * exists and does not refuse the data, else a clipboard copy, else nothing. Decided at
 * click time only, so the server and first client render never differ.
 */
export function shareAction(nav: ShareCapableNavigator | undefined, data: ShareData): ShareAction {
  if (!nav) return 'none';
  if (typeof nav.share === 'function' && nav.canShare?.(data) !== false) return 'share';
  if (typeof nav.clipboard?.writeText === 'function') return 'copy';
  return 'none';
}

/** A dismissed share sheet rejects with `AbortError`; that is the shopper's choice, not a failure. */
export function isShareAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}
