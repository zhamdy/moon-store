import type { BagTriggerStrings } from './bag-strings';
import { selectPlural } from './plural-templates';

/** The badge never grows past three glyphs; the accessible name keeps the real count. */
export const BADGE_OVERFLOW = '99+';
const BADGE_MAX = 99;

export interface BagTriggerLabel {
  /** `null` hides the badge: not hydrated or an empty bag, so first paint never shows a wrong number. */
  badgeText: string | null;
  ariaLabel: string;
  ariaHaspopup?: 'dialog';
  ariaCurrent?: 'page';
}

/**
 * The header Bag link's visible count and ARIA state (CD-12, CD-18). `count` is the local
 * sum of stored quantities, so sold-out and unavailable lines still count. The header count
 * is never live: the link's name carries it.
 *
 * Not hydrated yields exactly what the server rendered (label, no badge, no `aria-haspopup`),
 * so the first client render cannot mismatch. `aria-current` depends only on the pathname,
 * which the server knows too.
 */
export function bagTriggerLabel(
  hydrated: boolean,
  count: number,
  pathnameIsBag: boolean,
  strings: BagTriggerStrings,
  locale: string
): BagTriggerLabel {
  const counted = hydrated && count > 0;
  const result: BagTriggerLabel = {
    badgeText: counted ? (count > BADGE_MAX ? BADGE_OVERFLOW : String(count)) : null,
    ariaLabel: counted ? selectPlural(strings.count, count, locale) : strings.label,
  };
  if (pathnameIsBag) {
    result.ariaCurrent = 'page';
  } else if (hydrated) {
    result.ariaHaspopup = 'dialog';
  }
  return result;
}
