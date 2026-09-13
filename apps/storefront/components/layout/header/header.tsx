import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/ui/container';
import { BrandLogo } from '@/components/brand/brand-logo';
import { NavLink } from '../nav-link';
import { MobileMenu } from '../mobile-menu/mobile-menu';
import { getLocaleSwitcherLabels } from '../locale-labels';
import { primaryNavItems, mobileActionItems, desktopActionItems } from '../navigation-items';

export interface HeaderProps {
  /** The transparent-over-hero state is a seam for later, not yet rendered — see
   *  Scope Boundaries (no header scroll-transition logic in this task). */
  variant?: 'solid' | 'overlay';
}

export async function Header({ variant = 'solid' }: HeaderProps) {
  const t = await getTranslations('navigation');
  const localeSwitcher = await getLocaleSwitcherLabels();

  const mobileItems = primaryNavItems.map((item) => ({ ...item, label: t(item.messageKey) }));

  return (
    <header data-variant={variant} className="border-b border-border bg-bg">
      <Container
        as="div"
        className="flex h-[72px] items-center justify-between lg:grid lg:h-20 lg:grid-cols-[1fr_auto_1fr]"
      >
        <div className="flex flex-1 items-center lg:flex-none">
          <div className="lg:hidden">
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
              stays lazy; it is only fetched if the viewport is actually ≥1024px. */}
          <BrandLogo variant="mark" height={40} preload className="lg:hidden" />
          <BrandLogo variant="logo" height={56} className="hidden lg:block" />
        </Link>

        <div className="flex flex-1 items-center justify-end gap-1 lg:flex-none lg:gap-8">
          <div className="flex items-center gap-1 lg:hidden">
            {mobileActionItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-label={t(item.messageKey)}
                className="flex h-11 w-11 items-center justify-center"
              >
                <item.icon size={20} aria-hidden="true" />
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-8 lg:flex">
            {desktopActionItems.map((item) => (
              <NavLink key={item.key} href={item.href}>
                {t(item.messageKey)}
              </NavLink>
            ))}
          </div>
        </div>
      </Container>
    </header>
  );
}
