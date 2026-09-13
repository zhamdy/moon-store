import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/ui/container';
import { BrandLogo } from '@/components/brand/brand-logo';
import { NavLink } from '../nav-link';
import { LocaleSwitcher } from '../locale-switcher';
import { primaryNavItems } from '../navigation-items';

export async function Footer() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-bg">
      <Container as="div" className="section-y flex flex-col items-center gap-8 text-center">
        <Link href="/" aria-label="Moon Fashion">
          <BrandLogo variant="logo" height={96} />
        </Link>

        <nav
          aria-label={t('navigation.footerLabel')}
          className="flex flex-wrap items-center justify-center gap-6"
        >
          {primaryNavItems.map((item) => (
            <NavLink key={item.key} href={item.href}>
              {t(`navigation.${item.messageKey}`)}
            </NavLink>
          ))}
        </nav>

        <LocaleSwitcher />

        <p className="type-caption text-text-secondary">{t('footer.rights', { year })}</p>
      </Container>
    </footer>
  );
}
