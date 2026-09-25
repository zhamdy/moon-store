import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { PromotionBanner } from '@/components/promotion/promotion-banner';
import { loadFilmCredits } from '@/features/home/api/load-film-credits';
import { loadNewArrivals } from '@/features/home/api/load-new-arrivals';
import { CategoryPanels } from '@/features/home/components/category-panels/category-panels';
import { FilmHero } from '@/features/home/components/film-hero/film-hero';
import { Looks } from '@/features/home/components/looks/looks';
import { NewIn } from '@/features/home/components/new-in/new-in';

/**
 * The homepage, "Shop the Film" (owner decision 2026-09-26, concept C of the Claude Design
 * redesign): cinema that sells. Five sections — the film's opening frame with its
 * credits, the shop with a scene cut into it, the categories as panels, the offer as an
 * intermission, and the closing looks. Each section owns its container and surface; the
 * page only sequences them and reads the catalogue once for each of the two that need it.
 *
 * Still prerendered for both locales: nothing here reads request data. Both reads go
 * through the listing's data cache, and each degrades on its own when there is no API —
 * the credits disappear, the shop falls back to editorial frames — so the page keeps
 * rendering, and keeps building, without one.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // The layout already guards this; repeated because params arrive untyped here too.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const [credits, arrivals] = await Promise.all([loadFilmCredits(), loadNewArrivals()]);

  return (
    <>
      <FilmHero locale={locale} credits={credits} />
      <NewIn locale={locale} products={arrivals} />
      <CategoryPanels />
      <PromotionBanner />
      <Looks />
    </>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
