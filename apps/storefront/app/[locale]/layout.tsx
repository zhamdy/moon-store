import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, getDirection, type AppLocale } from '@/i18n/routing';
import { AppProviders } from '@/providers/app-providers';
import { SkipLink } from '@/components/layout/skip-link';
import { Header } from '@/components/layout/header/header';
import { Footer } from '@/components/layout/footer/footer';
import { BagTrigger } from '@/features/cart/components/bag-trigger';
import { catalogPath } from '@/features/catalog/utils/catalog-path';
import { getBagDrawerStrings, getBagTriggerStrings } from '@/features/cart/utils/bag-strings';
import { resolveSiteUrl } from '@/lib/site-url';
import { lora, inter, tajawal } from '../fonts';
import '../globals.css';

// Keyed by locale so a locale added to i18n/routing.ts fails to compile until mapped.
const fontVariables: Record<AppLocale, string> = {
  en: `${lora.variable} ${inter.variable}`,
  ar: tajawal.variable,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    // Read here, not at module load: see resolveSiteUrl.
    metadataBase: resolveSiteUrl(),
    title: {
      template: `%s · ${t('title')}`,
      default: t('title'),
    },
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  // Resolved strings only (never the catalogue): the drawer's ride in the trigger's props, so
  // the lazy chunk needs no second server round trip when it first opens.
  const [bagTriggerStrings, bagDrawerStrings] = await Promise.all([
    getBagTriggerStrings(locale),
    getBagDrawerStrings(locale),
  ]);

  return (
    <html lang={locale} dir={getDirection(locale)} className={fontVariables[locale]}>
      <body>
        {/* Kept for its locale (next-intl's client usePathname/Link read it from
            context), but messages={null}: left undefined, the server provider inherits
            the full catalogue and ships it to the browser. Client islands take
            translated strings as props instead. */}
        <NextIntlClientProvider messages={null}>
          <AppProviders>
            <SkipLink />
            <Header
              bag={
                <BagTrigger
                  strings={bagTriggerStrings}
                  drawerStrings={bagDrawerStrings}
                  shopHref={catalogPath({ kind: 'all' })}
                  locale={locale}
                />
              }
            />
            <main id="main-content" tabIndex={-1}>
              {children}
            </main>
            <Footer />
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
