import type { Metadata } from 'next';
import { routing, type AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { localizedDescription, localizedName } from './localized-name';

export type ProductMetadataInput = {
  locale: AppLocale;
  product: Pick<
    CatalogProductDetail,
    'slug' | 'name' | 'nameEn' | 'description' | 'descriptionEn' | 'images'
  >;
  /** `catalog.meta.productDescription`, already filled with the localized name. */
  fallbackDescription: (name: string) => string;
};

function productPath(locale: AppLocale, slug: string): string {
  return `/${locale}/products/${encodeURIComponent(slug)}`;
}

/**
 * Indexable, with a self canonical and both locale alternates; the route reads no
 * search params, so nothing else enters the URL. A description in the other language
 * is never used: the fallback message keeps the snippet in the page's language.
 */
export function buildProductMetadata({
  locale,
  product,
  fallbackDescription,
}: ProductMetadataInput): Metadata {
  const name = localizedName(product, locale);
  const description = localizedDescription(product, locale);
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, productPath(l, product.slug)])
  ) as Record<AppLocale, string>;
  const image = product.images[0]?.url;

  return {
    title: name.text,
    description:
      description && description.lang === locale
        ? description.text
        : fallbackDescription(name.text),
    alternates: {
      canonical: productPath(locale, product.slug),
      languages,
    },
    ...(image ? { openGraph: { images: [{ url: image }] } } : {}),
  };
}
