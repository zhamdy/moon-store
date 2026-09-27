import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { BagView } from '@/features/cart/components/bag-view';
import { getBagMetadataStrings, getBagPageStrings } from '@/features/cart/utils/bag-strings';
import { catalogPath } from '@/features/catalog/utils/catalog-path';
import { CategoryDirectory } from '@/features/catalog/components/category-directory';
import { loadCategoryCounts } from '@/features/collections/api/load-category-counts';

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
 * the island fills the review after hydration. No `loading.tsx`: nothing streams. The `h1`
 * is server markup handed to the island, which sets the piece count beside it. No entrance
 * motion: the design system keeps the bag still.
 */
export default async function BagPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const [strings, counts] = await Promise.all([getBagPageStrings(locale), loadCategoryCounts()]);

  return (
    <Container className="pt-8 pb-20 md:pt-12 md:pb-24 lg:pt-14 lg:pb-28">
      <BagView
        heading={<h1 className="type-page-title">{strings.title}</h1>}
        strings={strings}
        locale={locale}
        shopHref={catalogPath({ kind: 'all' })}
        emptyDirectory={<CategoryDirectory counts={counts} variant="tiles" />}
      />
    </Container>
  );
}
