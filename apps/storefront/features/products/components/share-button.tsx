'use client';

import { Share2 } from 'lucide-react';
import { showToast } from '@/components/feedback/show-toast';
import { isShareAbort, shareAction } from '../utils/share-action';

/** Copying twice replaces the toast rather than stacking a second. */
const SHARE_TOAST_ID = 'share-link';

export interface ShareButtonProps {
  url: string;
  title: string;
  labels: { share: string; copied: string; copyFailed: string };
}

/**
 * Opens the device share sheet (how Instagram, TikTok and Messenger are reached, since
 * they have no web share URL), or copies the link where the Web Share API is missing.
 * `navigator` is read only inside the click handler, so render output never depends on
 * the device. The copy result is a toast (owner decision 2026-09-15).
 */
export function ShareButton({ url, title, labels }: ShareButtonProps) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      showToast({ tone: 'success', message: labels.copied, id: SHARE_TOAST_ID });
    } catch {
      showToast({ tone: 'error', message: labels.copyFailed, id: SHARE_TOAST_ID });
    }
  }

  async function onClick() {
    const data = { url, title };
    if (shareAction(navigator, data) === 'share') {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (isShareAbort(error)) return;
      }
    }
    // A missing clipboard throws inside copy() and raises the failure toast.
    await copy();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 min-w-11 items-center gap-2 px-2 type-small text-text-secondary transition-colors duration-fast ease-ui hover:text-text"
    >
      <Share2 size={20} strokeWidth={1.5} aria-hidden="true" />
      {labels.share}
    </button>
  );
}
