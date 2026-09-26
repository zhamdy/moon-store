import type { Messages } from 'next-intl';

export interface NavItem {
  key: string;
  href: string;
  messageKey: keyof Messages['navigation'];
}

/**
 * The storefront's primary navigation, and all of it (design system 2026-09-25): Shop,
 * New In, Collections, then the locale switch and the Bag. The Search and Account icons
 * the header carried (user decision, 2026-09-13) linked to routes that do not exist yet
 * and are out of the approved header; they come back with their features, not before.
 * Bag is not listed: it renders last in the header's end cluster through the `bag` slot
 * (`BagTrigger`, a client island).
 */
export const primaryNavItems: NavItem[] = [
  { key: 'shop', href: '/shop', messageKey: 'shop' },
  { key: 'newIn', href: '/new-in', messageKey: 'newIn' },
  { key: 'collections', href: '/collections', messageKey: 'collections' },
];

/** The bag page, the header Bag link's href. */
export const BAG_HREF = '/bag';
