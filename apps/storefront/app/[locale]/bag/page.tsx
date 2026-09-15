import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { BagView } from '@/features/cart/components/bag-view';
import { getBagMetadataStrings, getBagPageStrings } from '@/features/cart/utils/bag-strings';
import { catalogPath } from '@/features/catalog/utils/catalog-path';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * `noindex, nofollow` and no canonical or language alternates: the page is per-browser
 * state with nothing to index, so a canonical would only point crawlers at it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const { title, description } = await getBagMetadataStrings(locale);
  return { title, description, robots: { index: false, follow: false } };
}

/**
 * `/bag` (plan Unit 7): outside `(catalog)`, since it fetches nothing on the server and
 * needs no catalog error boundary; static per locale. The bag lives in the browser, so
 * the island fills the review after hydration. No `loading.tsx`: nothing streams.
 */
export default async function BagPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const strings = await getBagPageStrings(locale);

  return (
    <Container className="pt-10 pb-20 md:pt-14 md:pb-24 lg:pt-16 lg:pb-32">
      <Reveal className="pb-10 md:pb-12">
        <h1 data-motion="rise" className="type-h1 [--motion-offset:120ms] [--motion-rise:24px]">
          {strings.title}
        </h1>
      </Reveal>
      <BagView strings={strings} locale={locale} shopHref={catalogPath({ kind: 'all' })} />
    </Container>
  );
}
