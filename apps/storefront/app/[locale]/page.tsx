import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Hero } from '@/features/home/components/hero/hero';
import { EditorialStrip } from '@/features/home/components/editorial-strip/editorial-strip';
import { NewArrivals } from '@/features/home/components/new-arrivals/new-arrivals';
import { PromoBanner } from '@/features/home/components/promo-banner/promo-banner';
import { FeaturedCollection } from '@/features/home/components/featured-collection/featured-collection';
import { CategoryGrid } from '@/features/home/components/category-grid/category-grid';
import { Campaign } from '@/features/home/components/campaign/campaign';
import { CuratedEdit } from '@/features/home/components/curated-edit/curated-edit';
import { Benefits } from '@/features/home/components/benefits/benefits';
import { Lookbook } from '@/features/home/components/lookbook/lookbook';

/**
 * The homepage composes the guideline §12 sections in order, minus Newsletter
 * (§12·11, excluded by the brief). Each section owns its container/bleed and
 * background decision; the page only sequences them. Static (SSG) for both
 * locales — nothing here reads request data.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // The layout already guards this; repeated because params arrive untyped here too.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <EditorialStrip />
      <NewArrivals locale={locale} />
      <PromoBanner />
      <FeaturedCollection />
      <CategoryGrid />
      <Campaign />
      <CuratedEdit locale={locale} />
      <Benefits />
      <Lookbook />
    </>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
