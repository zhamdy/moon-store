import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/ui/container';
import { BrandLogo } from '@/components/brand/brand-logo';
import { NavLink } from '../nav-link';
import { LocaleSwitcher } from '../locale-switcher';
import { getLocaleSwitcherLabels } from '../locale-labels';
import { primaryNavItems } from '../navigation-items';

/**
 * A deep-ink close (guideline §12·12 "ivory or deep ink"): the Lookbook ends on
 * ivory imagery, and ink is the surface the gold logo reads best on. Spacious —
 * the lockup and a one-line tagline (the site description, reused verbatim so no
 * About-shaped copy is written), the three shop links, the language switcher,
 * and a copyright line under the only gold in the footer, a hairline. No social,
 * contact, policies, newsletter or customer care (Scope Boundaries, R6).
 * `data-surface="ink"` swaps the text/bg/border tokens and the focus ring.
 */
export async function Footer() {
  const t = await getTranslations();
  const localeSwitcher = await getLocaleSwitcherLabels();
  const year = new Date().getFullYear();

  return (
    <footer data-surface="ink" className="bg-bg text-text">
      <Container as="div" className="section-y">
        <div className="grid-editorial">
          <div className="col-span-4">
            <Link href="/" aria-label="Moon Fashion" className="inline-block">
              <BrandLogo variant="logo" height={120} />
            </Link>
            <p className="type-body mt-8 max-w-xs text-text-secondary">{t('footer.tagline')}</p>
          </div>

          <nav
            aria-label={t('navigation.footerLabel')}
            className="col-span-2 lg:col-span-3 lg:col-start-7"
          >
            <h2 className="type-label font-body text-text-secondary">{t('footer.shopLabel')}</h2>
            <ul className="mt-6 flex flex-col gap-4">
              {primaryNavItems.map((item) => (
                <li key={item.key}>
                  <NavLink href={item.href} typography="type-body">
                    {t(`navigation.${item.messageKey}`)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-span-2 lg:col-span-3 lg:col-start-10">
            <h2 className="type-label font-body text-text-secondary">
              {localeSwitcher.groupLabel}
            </h2>
            <div className="mt-6">
              <LocaleSwitcher {...localeSwitcher} />
            </div>
          </div>
        </div>

        <div className="mt-20 border-t border-brand pt-6 lg:mt-28">
          <p className="type-caption text-text-secondary">{t('footer.rights', { year })}</p>
        </div>
      </Container>
    </footer>
  );
}
