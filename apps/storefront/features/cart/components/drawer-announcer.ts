import { useSyncExternalStore } from 'react';

/**
 * The drawer's one polite message (plan *Announcement policy*). The live region is rendered
 * by the always-mounted `BagTrigger`, so it exists before the lazy drawer writes to it; the
 * drawer calls `announceInDrawer` and never renders a region of its own.
 *
 * Kept apart from the cart store: a message is transient UI, not bag or session state, and
 * writing it must not re-render every store subscriber.
 */

let message = '';
let generation = 0;
const listeners = new Set<() => void>();

function publish(next: string) {
  message = next;
  for (const listener of [...listeners]) {
    listener();
  }
}

/**
 * Writes `next` to the drawer's live region. Call only after mount (from an effect or an
 * event handler). Repeating the current text clears the region first and rewrites it on
 * the next frame, so screen readers announce it again.
 */
export function announceInDrawer(next: string): void {
  const token = ++generation;
  if (next !== '' && next === message && typeof requestAnimationFrame === 'function') {
    publish('');
    // A newer message published before the frame wins.
    requestAnimationFrame(() => {
      if (token === generation) publish(next);
    });
    return;
  }
  publish(next);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current message, outside React (the hook's snapshot). */
export const getDrawerAnnouncement = () => message;
const getSnapshot = getDrawerAnnouncement;
const getServerSnapshot = () => '';

/** The current message; always `''` on the server and during hydration. */
export function useDrawerAnnouncement(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
