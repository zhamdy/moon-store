import { Search, ShoppingBag, UserRound, type LucideIcon } from 'lucide-react';
import type { Messages } from 'next-intl';

export interface NavItem {
  key: string;
  href: string;
  messageKey: keyof Messages['navigation'];
}

export interface ActionNavItem extends NavItem {
  icon: LucideIcon;
  /** Hidden below 1024px, where the item lives in the mobile menu instead. */
  desktopOnly?: boolean;
}

export const primaryNavItems: NavItem[] = [
  { key: 'shop', href: '/shop', messageKey: 'shop' },
  { key: 'newIn', href: '/new-in', messageKey: 'newIn' },
  { key: 'collections', href: '/collections', messageKey: 'collections' },
];

/**
 * Header actions, icon-only at every breakpoint (user decision, 2026-09-13). The
 * translated label is the link's accessible name. Account is desktop-only: on
 * mobile it lives in the mobile menu's lower band.
 */
export const headerActionItems: ActionNavItem[] = [
  { key: 'search', href: '/search', messageKey: 'search', icon: Search },
  { key: 'account', href: '/account', messageKey: 'account', icon: UserRound, desktopOnly: true },
  { key: 'bag', href: '/bag', messageKey: 'bag', icon: ShoppingBag },
];

export const accountItem: NavItem = { key: 'account', href: '/account', messageKey: 'account' };
