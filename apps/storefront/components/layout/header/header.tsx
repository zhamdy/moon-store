import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/ui/container';
import { BrandLogo } from '@/components/brand/brand-logo';
import { NavLink } from '../nav-link';
import { MobileMenu } from '../mobile-menu/mobile-menu';
import { getLocaleSwitcherLabels } from '../locale-labels';
import { cn } from '@/lib/utils/cn';
import { primaryNavItems, headerActionItems } from '../navigation-items';
import { HeaderShell } from './header-shell';

/**
 * Server Component. `HeaderShell` (client) owns the `<header>` element and its
 * `data-surface`: transparent with ivory text over a page's hero, ivory with ink
 * text and a hairline everywhere else — see header-shell.tsx and the Surfaces
 * section of app/globals.css. Colours come from `text-text` / `bg-bg` /
 * `border-border` as usual; the surface swaps what those resolve to.
 *
 * Sticky, above the hero (which is later in DOM order and positioned for its
 * scrim), keeping its `--header-h` flow slot so non-home pages need nothing.
 */
export async function Header() {
  const t = await getTranslations('navigation');
  const localeSwitcher = await getLocaleSwitcherLabels();

  const mobileItems = primaryNavItems.map((item) => ({ ...item, label: t(item.messageKey) }));

  return (
    <HeaderShell className="sticky top-0 z-40 border-b border-border bg-bg text-text">
      <Container
        as="div"
        className="flex h-(--header-h) items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]"
      >
        <div className="flex flex-1 items-center lg:flex-none">
          <div className="-ms-2.5 lg:hidden">
            <MobileMenu
              menuLabel={t('menu')}
              closeLabel={t('closeMenu')}
              primaryLabel={t('primaryLabel')}
              accountLabel={t('account')}
              items={mobileItems}
              localeSwitcher={localeSwitcher}
            />
          </div>

          <nav aria-label={t('primaryLabel')} className="hidden items-center gap-8 lg:flex">
            {primaryNavItems.map((item) => (
              <NavLink key={item.key} href={item.href}>
                {t(item.messageKey)}
              </NavLink>
            ))}
          </nav>
        </div>

        <Link href="/" aria-label="Moon Fashion" className="flex items-center justify-center">
          {/* Only one variant is ever visible (CSS breakpoint), but Next.js emits a
              <link rel="preload"> for whichever carries `preload` regardless of
              display:none — so only the mobile-default gets it. The desktop variant
              stays lazy; it is only fetched if the viewport is actually ≥1024px.
              The gold artwork is never recoloured for the overlay surface: the hero
              is dusk-toned so gold reads on it (see apps/storefront/CLAUDE.md). */}
          <BrandLogo variant="mark" height={36} preload className="lg:hidden" />
          <BrandLogo variant="logo" height={52} className="hidden lg:block" />
        </Link>

        {/* Negative inline-end margin so the last glyph, not its 44px hit area,
            aligns with the page gutter. */}
        <div className="-me-2.5 flex flex-1 items-center justify-end gap-1 lg:flex-none lg:gap-2">
          {headerActionItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-label={t(item.messageKey)}
              className={cn(
                'h-11 w-11 items-center justify-center transition-opacity duration-fast ease-ui hover:opacity-70',
                item.desktopOnly ? 'hidden lg:flex' : 'flex'
              )}
            >
              <item.icon size={20} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Container>
    </HeaderShell>
  );
}
