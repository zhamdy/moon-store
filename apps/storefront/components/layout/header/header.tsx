import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/ui/container';
import { BrandLogo } from '@/components/brand/brand-logo';
import { MobileMenu } from '../mobile-menu/mobile-menu';
import { getLocaleSwitcherLabels, getLocaleToggleLabels } from '../locale-labels';
import { LocaleToggle } from '../locale-switcher';
import { primaryNavItems } from '../navigation-items';
import { DesktopNav } from './desktop-nav';
import { HeaderShell } from './header-shell';

export interface HeaderNavContent {
  /** The desktop Shop panel (`ShopPanel`), composed by the layout. */
  shopPanel: ReactNode;
  /** The desktop Collections panel, or `null`: Collections is then a plain link. */
  collectionsPanel: ReactNode | null;
  /** The mobile menu's sections, composed by the layout (`MenuShopSection`, …). */
  menuShop: ReactNode;
  menuCollections: ReactNode | null;
  menuFeatured: ReactNode | null;
}

/**
 * Server Component. `HeaderShell` (client) owns the `<header>` element and its
 * `data-surface`: transparent with ivory text over a page's hero, ivory with ink text and
 * a hairline edge everywhere else — see header-shell.tsx and the Surfaces section of
 * app/globals.css. Colours come from `text-text` / `bg-bg` as usual; the surface swaps
 * what those resolve to.
 *
 * Header direction B (2026-09-26, chosen from the Claude Design header study): primary
 * navigation at the inline start — Shop and Collections open full-width panels
 * (`DesktopNav`), New In is a link — the crescent mark centred, and at the inline end the
 * language toggle (a globe and the other language's name) and the Bag ("Bag (2)" from
 * 1024). Below 1024 the navigation folds into a Menu button (glyph and word) whose sheet
 * opens Shop and Collections in place. The panels' and the menu's content arrives from
 * the layout as `nav` (`features/collections/components/header-panels.tsx`), so this
 * file imports no feature slice. No search or account until those features exist.
 *
 * Sticky, above the hero (which is later in DOM order and positioned for its scrim),
 * keeping its `--header-h` flow slot so non-home pages need nothing. `bag` is the Bag
 * action, composed by the layout (`BagTrigger`) so the header imports no feature slice.
 */
export async function Header({ bag, nav }: { bag: ReactNode; nav: HeaderNavContent }) {
  const t = await getTranslations('navigation');
  const tCommon = await getTranslations('common');
  const localeSwitcher = await getLocaleSwitcherLabels();
  const localeToggle = await getLocaleToggleLabels();

  const mobileItems = primaryNavItems.map((item) => ({ ...item, label: t(item.messageKey) }));
  const panels: Record<string, ReactNode | null> = {
    shop: nav.shopPanel,
    collections: nav.collectionsPanel,
  };
  const desktopItems = primaryNavItems.map((item) => ({
    key: item.key,
    href: item.href,
    label: t(item.messageKey),
    panel: panels[item.key] ?? undefined,
  }));

  return (
    <HeaderShell className="sticky top-0 z-(--z-header) bg-bg text-text">
      <Container
        as="div"
        className="grid h-(--header-h) grid-cols-[1fr_auto_1fr] items-center gap-4"
      >
        <div className="flex items-center justify-self-start">
          <div className="-ms-2.5 flex items-center lg:hidden">
            <MobileMenu
              menuLabel={t('menu')}
              closeLabel={t('closeMenu')}
              primaryLabel={t('primaryLabel')}
              items={mobileItems}
              localeSwitcher={localeSwitcher}
              closeText={t('close')}
              sections={{
                shop: nav.menuShop,
                collections: nav.menuCollections,
                featured: nav.menuFeatured,
              }}
            />
          </div>

          <div className="hidden lg:flex">
            <DesktopNav items={desktopItems} label={t('primaryLabel')} />
          </div>
        </div>

        <Link
          href="/"
          aria-label={tCommon('brandName')}
          className="flex items-center justify-center justify-self-center"
        >
          {/* The crescent mark alone, at every width: the stacked lockup is unreadable at
              header height, and the footer carries the full lockup. The gold artwork is
              never recoloured for the overlay surface (see apps/storefront/CLAUDE.md). */}
          <BrandLogo variant="mark" height={48} preload className="h-10 w-auto lg:h-12" />
        </Link>

        {/* Negative inline-end margin so the last glyph, not its 44px hit area, aligns
            with the page gutter. */}
        <div className="-me-2.5 flex items-center gap-1 justify-self-end lg:gap-3">
          <LocaleToggle {...localeToggle} />
          {bag}
        </div>
      </Container>
    </HeaderShell>
  );
}
