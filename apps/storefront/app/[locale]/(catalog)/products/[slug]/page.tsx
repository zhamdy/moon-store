import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import {
  RelatedProducts,
  RelatedProductsSkeleton,
} from '@/features/catalog/components/related-products';
import { catalogPath } from '@/features/catalog/utils/catalog-path';
import { relatedScope } from '@/features/catalog/utils/related-scope';
import { getCatalogProduct } from '@/features/products/api/get-catalog-product';
import { loadStorePolicies } from '@/features/products/api/load-store-policies';
import { ProductBreadcrumb } from '@/features/products/components/product-breadcrumb';
import { ProductDetail } from '@/features/products/components/product-detail';
import { ProductDetailsTabs } from '@/features/products/components/product-details-tabs';
import { ProductGallery } from '@/features/products/components/product-gallery';
import { ProductShare } from '@/features/products/components/product-share';
import { PurchasePanelSlot } from '@/features/products/components/purchase-panel-slot';
import { buildProductMetadata } from '@/features/products/utils/product-metadata';

type Props = PageProps<'/[locale]/products/[slug]'>;

/**
 * The active product, or `notFound()` before anything renders (KD-10). One
 * `React.cache`d read serves both the page and `generateMetadata`.
 */
async function resolve(props: Props) {
  // Reads no searchParams, so without this the route would be prerendered and full-route
  // cached at runtime, outside the data-cache lifetime the catalog relies on (PD-8).
  await connection();
  const { locale, slug } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const product = await getCatalogProduct(slug);
  if (!product) notFound();
  return { locale: locale as AppLocale, product };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, product } = await resolve(props);
  const t = await getTranslations({ locale, namespace: 'catalog' });

  return buildProductMetadata({
    locale,
    product,
    fallbackDescription: (name) => t('meta.productDescription', { name }),
  });
}

export default async function ProductPage(props: Props) {
  const { locale, product } = await resolve(props);
  setRequestLocale(locale);
  // Only once the product is known, so it never delays or masks a 404 (KD-10). Contained:
  // a failed read yields null and only drops the Shipping tab.
  const policies = await loadStorePolicies();

  const hrefs = {
    category: product.category
      ? catalogPath({ kind: 'category', slug: product.category.slug })
      : null,
    collections: Object.fromEntries(
      product.collections.map((c) => [c.slug, catalogPath({ kind: 'collection', slug: c.slug })])
    ),
  };

  return (
    <ProductDetail
      locale={locale}
      product={product}
      hrefs={hrefs}
      breadcrumb={
        <ProductBreadcrumb
          locale={locale}
          product={product}
          hrefs={{ home: '/', shop: catalogPath({ kind: 'all' }), category: hrefs.category }}
        />
      }
      gallery={<ProductGallery locale={locale} product={product} />}
      purchase={<PurchasePanelSlot key={product.slug} locale={locale} product={product} />}
      share={<ProductShare locale={locale} product={product} />}
      details={
        <ProductDetailsTabs locale={locale} product={product} policies={policies} hrefs={hrefs} />
      }
      related={
        relatedScope(product) ? (
          <Suspense fallback={<RelatedProductsSkeleton />}>
            <RelatedProducts locale={locale} product={product} />
          </Suspense>
        ) : undefined
      }
    />
  );
}
