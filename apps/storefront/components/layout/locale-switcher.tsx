'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * Needs the current pathname (to preserve it across the locale switch) — the one
 * allowed client exception beyond AppProviders and MobileMenu (R21/R22).
 */
export function LocaleSwitcher() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('common');

  return (
    <div className="flex items-center gap-3" role="group" aria-label={t('languageLabel')}>
      {routing.locales.map((loc) => {
        const label = loc === 'en' ? t('english') : t('arabic');

        if (loc === locale) {
          return (
            <span key={loc} aria-current="true" className="type-label text-text">
              {label}
            </span>
          );
        }

        return (
          <Link
            key={loc}
            href={pathname}
            locale={loc}
            lang={loc}
            className="type-label text-text-secondary transition-colors duration-fast ease-ui hover:text-text"
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
