import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, getDirection } from '@/i18n/routing';
import { AppProviders } from '@/providers/app-providers';
import { bodoniModa, manrope, notoNaskhArabic, ibmPlexSansArabic } from '../fonts';
import '../globals.css';

const latinFontVariables = `${bodoniModa.variable} ${manrope.variable}`;
const arabicFontVariables = `${notoNaskhArabic.variable} ${ibmPlexSansArabic.variable}`;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
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

  const fontVariables = locale === 'ar' ? arabicFontVariables : latinFontVariables;

  return (
    <html lang={locale} dir={getDirection(locale)} className={fontVariables}>
      <body>
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
