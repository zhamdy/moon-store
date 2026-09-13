'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

export interface LocaleSwitcherProps {
  /** A label per locale, so a locale added to routing.ts fails to compile until named. */
  labels: Record<AppLocale, string>;
  groupLabel: string;
}

/**
 * Needs the current pathname (to preserve it across the locale switch) — the one
 * allowed client exception beyond AppProviders and MobileMenu (R21/R22). Receives
 * translated strings as props rather than the message catalogue.
 */
export function LocaleSwitcher({ labels, groupLabel }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <div className="flex items-center gap-3" role="group" aria-label={groupLabel}>
      {routing.locales.map((loc) => {
        const label = labels[loc];

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
