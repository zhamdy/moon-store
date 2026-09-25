import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/ui/container';
import { BrandLogo } from '@/components/brand/brand-logo';
import { NavLink } from '../nav-link';
import { MobileMenu } from '../mobile-menu/mobile-menu';
import { getLocaleSwitcherLabels, getLocaleToggleLabels } from '../locale-labels';
import { LocaleToggle } from '../locale-switcher';
import { primaryNavItems } from '../navigation-items';
import { HeaderShell } from './header-shell';

/**
 * Server Component. `HeaderShell` (client) owns the `<header>` element and its
 * `data-surface`: transparent with ivory text over a page's hero, ivory with ink text and
 * a hairline edge everywhere else — see header-shell.tsx and the Surfaces section of
 * app/globals.css. Colours come from `text-text` / `bg-bg` as usual; the surface swaps
 * what those resolve to.
 *
 * The design system's header (2026-09-25): primary navigation at the inline start, the
 * crescent mark centred, the language toggle and the Bag at the inline end. Below 1024
 * the navigation folds into a Menu button (glyph and word) at the start. Nothing else
 * lives here — no search or account until those features exist.
 *
 * Sticky, above the hero (which is later in DOM order and positioned for its scrim),
 * keeping its `--header-h` flow slot so non-home pages need nothing. `bag` is the Bag
 * action, composed by the layout (`BagTrigger`) so the header imports no feature slice.
 */
export async function Header({ bag }: { bag: ReactNode }) {
  const t = await getTranslations('navigation');
  const tCommon = await getTranslations('common');
  const localeSwitcher = await getLocaleSwitcherLabels();
  const localeToggle = await getLocaleToggleLabels();

  const mobileItems = primaryNavItems.map((item) => ({ ...item, label: t(item.messageKey) }));

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
            />
          </div>

          <nav aria-label={t('primaryLabel')} className="hidden items-center gap-9 lg:flex">
            {primaryNavItems.map((item) => (
              <NavLink
                key={item.key}
                href={item.href}
                // A 44px target inside the header's height; the rule stays under the word.
                className="inline-flex min-h-(--size-tap) items-center py-0 after:bottom-2.5"
              >
                {t(item.messageKey)}
              </NavLink>
            ))}
          </nav>
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
