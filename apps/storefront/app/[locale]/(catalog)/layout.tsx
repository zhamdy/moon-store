import type { ReactNode } from 'react';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/**
 * The catalog route group (URLs unchanged). Its only job is the strings `error.tsx`
 * needs: an error boundary is a client component, so it cannot take resolved strings
 * as props. This nested provider carries `catalog.error` and nothing else, the one
 * recorded exception to the locale layout's `messages={null}` (KD-14).
 *
 * It fetches nothing from the API, so it cannot throw past the boundary it serves.
 * The locale layout above has already rejected an unknown locale.
 */
export default async function CatalogLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={{ catalog: { error: messages.catalog.error } }}>
      {children}
    </NextIntlClientProvider>
  );
}
