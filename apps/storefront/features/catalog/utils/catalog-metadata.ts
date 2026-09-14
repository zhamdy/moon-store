import type { Metadata } from 'next';
import { routing, type AppLocale } from '@/i18n/routing';
import { hasNonDefaultRefinements, type CatalogParams } from '../search-params';

export type CatalogMetadataInput = {
  locale: AppLocale;
  /** Locale-less route path, e.g. `/shop/dresses`. */
  path: string;
  title: string;
  description: string;
  /** Output of `loadCatalogParams`, so a route-default sort is already `null`. */
  params: Pick<CatalogParams, 'sort' | 'stock' | 'min' | 'max' | 'page'>;
};

function localizedPath(locale: AppLocale, path: string, page: number): string {
  const trimmed = path.replace(/\/+$/, '');
  const route = trimmed === '' || trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `/${locale}${route}${page > 1 ? `?page=${page}` : ''}`;
}

/**
 * Canonical is the path plus `?page=N` past page 1, so paginated pages stay indexable
 * with a self canonical; sort and filters never enter it. A sorted or filtered URL is
 * `noindex, follow`. Language alternates point at the same page in each locale. URLs
 * are relative and resolve against the layout's `metadataBase`.
 */
export function buildCatalogMetadata({
  locale,
  path,
  title,
  description,
  params,
}: CatalogMetadataInput): Metadata {
  const page = params.page > 1 ? params.page : 1;
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, localizedPath(l, path, page)])
  ) as Record<AppLocale, string>;

  return {
    title,
    description,
    alternates: {
      canonical: localizedPath(locale, path, page),
      languages,
    },
    ...(hasNonDefaultRefinements(params) ? { robots: { index: false, follow: true } } : {}),
  };
}
