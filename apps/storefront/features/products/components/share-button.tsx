'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { isShareAbort, shareAction } from '../utils/share-action';

const STATUS_MS = 2500;

export interface ShareButtonProps {
  url: string;
  title: string;
  labels: { share: string; copied: string; copyFailed: string };
}

/**
 * Opens the device share sheet (how Instagram, TikTok and Messenger are reached, since
 * they have no web share URL), or copies the link where the Web Share API is missing.
 * `navigator` is read only inside the click handler, so render output never depends on
 * the device. The status region is always mounted so a change to it is announced.
 */
export function ShareButton({ url, title, labels }: ShareButtonProps) {
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function announce(message: string) {
    clearTimeout(timer.current);
    setStatus(message);
    timer.current = setTimeout(() => setStatus(''), STATUS_MS);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      announce(labels.copied);
    } catch {
      announce(labels.copyFailed);
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
    // A missing clipboard throws inside copy() and announces the failure.
    await copy();
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 min-w-11 items-center gap-2 px-2 type-small text-text-secondary transition-colors duration-fast ease-ui hover:text-text"
      >
        <Share2 size={20} strokeWidth={1.5} aria-hidden="true" />
        {labels.share}
      </button>
      <span role="status" aria-live="polite" className="type-small text-text-secondary">
        {status}
      </span>
    </>
  );
}
