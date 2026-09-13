import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Container } from '@/components/ui/container';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // The layout already guards this; repeated because params arrive untyped here too.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations('foundation');

  return (
    <Container as="section" className="section-y">
      <h1 className="type-display">{t('title')}</h1>
      <p className="type-body text-text-secondary">{t('subtitle')}</p>
    </Container>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
