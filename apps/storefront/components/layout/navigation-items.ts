import { Search, ShoppingBag, type LucideIcon } from 'lucide-react';

export interface NavItem {
  key: string;
  href: string;
  messageKey: 'shop' | 'newIn' | 'collections' | 'search' | 'account' | 'bag';
}

export interface ActionNavItem extends NavItem {
  icon: LucideIcon;
}

export const primaryNavItems: NavItem[] = [
  { key: 'shop', href: '/shop', messageKey: 'shop' },
  { key: 'newIn', href: '/new-in', messageKey: 'newIn' },
  { key: 'collections', href: '/collections', messageKey: 'collections' },
];

/** Mobile header actions: search and bag only — account lives in the mobile menu. */
export const mobileActionItems: ActionNavItem[] = [
  { key: 'search', href: '/search', messageKey: 'search', icon: Search },
  { key: 'bag', href: '/bag', messageKey: 'bag', icon: ShoppingBag },
];

/** Desktop header actions: text links, search/account/bag together. */
export const desktopActionItems: NavItem[] = [
  { key: 'search', href: '/search', messageKey: 'search' },
  { key: 'account', href: '/account', messageKey: 'account' },
  { key: 'bag', href: '/bag', messageKey: 'bag' },
];

export const accountItem: NavItem = { key: 'account', href: '/account', messageKey: 'account' };
