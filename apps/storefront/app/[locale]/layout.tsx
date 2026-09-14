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
import { lora, inter, tajawal } from '../fonts';
import '../globals.css';

// Keyed by locale so a locale added to i18n/routing.ts fails to compile until mapped.
const fontVariables: Record<AppLocale, string> = {
  en: `${lora.variable} ${inter.variable}`,
  ar: tajawal.variable,
};

const DEV_SITE_URL = 'http://localhost:3000';

// Read inside generateMetadata, not at module load, so the value comes from the
// environment the metadata is rendered in. Plain process.env is not a request API,
// so the homepage stays SSG. Missing or malformed in production logs loudly rather
// than failing the render; canonical links would then point at localhost.
function resolveMetadataBase(): URL {
  const configured = process.env.SITE_URL;
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      console.error(`SITE_URL is not an absolute URL ("${configured}"); using ${DEV_SITE_URL}`);
      return new URL(DEV_SITE_URL);
    }
  }
  if (process.env.NODE_ENV === 'production') {
    console.error(`SITE_URL is not set; canonical and alternate links use ${DEV_SITE_URL}`);
  }
  return new URL(DEV_SITE_URL);
}

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
    metadataBase: resolveMetadataBase(),
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
            <Header />
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
