'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';

export interface LocaleSwitcherProps {
  /** A label per locale, so a locale added to routing.ts fails to compile until named. */
  labels: Record<AppLocale, string>;
  groupLabel: string;
}

/**
 * Needs the current pathname (to preserve it across the locale switch), so it is
 * one of the storefront's seven client boundaries (R21/R22; the list lives in
 * apps/storefront/CLAUDE.md). Receives translated strings as props rather than the
 * message catalogue.
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

export interface LocaleToggleProps {
  /** Full locale names, the link's accessible name (`common.localeNames`). */
  labels: Record<AppLocale, string>;
  /** Compact visible labels (`common.localeShort`), used below 1024px. */
  shortLabels: Record<AppLocale, string>;
  className?: string;
}

/**
 * The header's language toggle: one link to the *other* locale, preserving the
 * current path. Lives in this module so it shares LocaleSwitcher's client
 * boundary rather than adding one. Written for the two locales `routing.ts`
 * defines today — with a third, the header needs LocaleSwitcher's list instead.
 *
 * The visible text is the target language in its own script (`العربية` on /en,
 * `English` on /ar), shortened below 1024px; `lang` on the link makes screen
 * readers pronounce it correctly.
 */
export function LocaleToggle({ labels, shortLabels, className }: LocaleToggleProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const target = routing.locales.find((loc) => loc !== locale) ?? routing.defaultLocale;

  return (
    <Link
      href={pathname}
      locale={target}
      lang={target}
      aria-label={labels[target]}
      className={cn(
        'type-label flex h-11 min-w-11 items-center justify-center px-2 text-text',
        'transition-opacity duration-fast ease-ui hover:opacity-70',
        className
      )}
    >
      <span className="lg:hidden">{shortLabels[target]}</span>
      <span className="hidden lg:inline">{labels[target]}</span>
    </Link>
  );
}
