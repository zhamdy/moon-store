import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { BAG_HREF } from '@/components/layout/navigation-items';
import { Container } from '@/components/ui/container';
import { CHECKOUT_ENABLED } from '@/features/cart/utils/checkout-availability';
import { catalogPath } from '@/features/catalog/utils/catalog-path';
import { CategoryDirectory } from '@/features/catalog/components/category-directory';
import { loadCategoryCounts } from '@/features/collections/api/load-category-counts';
import { CheckoutView } from '@/features/checkout/components/checkout-view';
import {
  getCheckoutMetadataStrings,
  getCheckoutPageStrings,
} from '@/features/checkout/utils/checkout-strings';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** `noindex, nofollow` and no canonical: per-browser state with nothing to index, like `/bag`. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || !CHECKOUT_ENABLED) {
    notFound();
  }
  const { title, description } = await getCheckoutMetadataStrings(locale);
  return { title, description, robots: { index: false, follow: false } };
}

/**
 * `/checkout` (plan 2026-09-15-002, Units 6-7): outside `(catalog)`, static per locale, no
 * `loading.tsx`. The bag lives in the browser, so the island fills the page after hydration.
 * A real 404 when Checkout is off in this build (CO-22): not public in production until a
 * commerce strategy exists. Nothing here creates an order, reserves stock or takes payment.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || !CHECKOUT_ENABLED) {
    notFound();
  }
  setRequestLocale(locale);
  const [strings, counts] = await Promise.all([
    getCheckoutPageStrings(locale),
    loadCategoryCounts(),
  ]);

  return (
    <Container className="pt-6 pb-20 md:pt-8 md:pb-24 lg:pt-10 lg:pb-32">
      <Link
        href={BAG_HREF}
        className="type-small -ms-1 inline-flex min-h-11 items-center gap-2 ps-1 text-text-secondary transition-colors duration-fast ease-ui hover:text-text"
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" className="rtl:-scale-x-100" />
        {strings.backToBag}
      </Link>
      {/* No entrance: the design system keeps the bag and checkout still ("Fitting room"). */}
      <h1 className="type-page-title mt-2 pb-8 md:pb-9">{strings.title}</h1>
      <CheckoutView
        strings={strings}
        locale={locale}
        shopHref={catalogPath({ kind: 'all' })}
        bagHref={BAG_HREF}
        deliveryMethods={[]}
        emptyDirectory={<CategoryDirectory counts={counts} variant="tiles" />}
      />
    </Container>
  );
}
