import type { AppLocale } from '@/i18n/routing';
import type { CatalogProductContext, CatalogProductDetail } from '../types/catalog-product-detail';
import type { StorePolicies } from '../types/store-policies';
import {
  localizedDescription,
  localizedName,
  localizedText,
  type LocalizedText,
} from './localized-name';

/** Paragraphs split on blank lines, trimmed, empties dropped; single breaks are kept. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * The lead under the price: the first paragraph of the localized description. The rest,
 * if any, is the "More about this piece" fold (`productInfo`), so nothing is said twice.
 */
export function productLead(
  product: Pick<CatalogProductDetail, 'description' | 'descriptionEn'>,
  locale: AppLocale
): LocalizedText | null {
  const description = localizedDescription(product, locale);
  const first = description ? splitParagraphs(description.text)[0] : undefined;
  return description && first ? { text: first, lang: description.lang } : null;
}

export interface DetailsLink {
  slug: string;
  name: LocalizedText;
}

export type DetailsRow =
  | { id: 'material' | 'care' | 'fit'; kind: 'text'; value: LocalizedText }
  | { id: 'category' | 'collection'; kind: 'links'; links: DetailsLink[] }
  | { id: 'sizes'; kind: 'values'; values: string[] };

export interface PolicySection {
  id: 'delivery' | 'returns';
  lang: AppLocale;
  paragraphs: string[];
}

export interface ProductInfoModel {
  /** The facts list, in display order; empty rows are not in it. */
  rows: DetailsRow[];
  /** The description after the lead paragraph, or `null` when it is one paragraph. */
  more: { lang: AppLocale; paragraphs: string[] } | null;
  /** The Shipping & returns fold; empty when the policies are missing or failed. */
  shipping: PolicySection[];
}

function link(context: CatalogProductContext, locale: AppLocale): DetailsLink {
  return { slug: context.slug, name: localizedName(context, locale) };
}

function detailsRows(product: CatalogProductDetail, locale: AppLocale): DetailsRow[] {
  const rows: DetailsRow[] = [];
  const texts = [
    ['material', product.material, product.materialEn],
    ['care', product.care, product.careEn],
    ['fit', product.fit, product.fitEn],
  ] as const;
  for (const [id, ar, en] of texts) {
    const value = localizedText(ar, en, locale);
    if (value) rows.push({ id, kind: 'text', value });
  }
  if (product.category) {
    rows.push({ id: 'category', kind: 'links', links: [link(product.category, locale)] });
  }
  if (product.collections.length > 0) {
    rows.push({
      id: 'collection',
      kind: 'links',
      links: product.collections.map((collection) => link(collection, locale)),
    });
  }
  const sizes = product.options.find((option) => option.key === 'size')?.values ?? [];
  if (sizes.length > 0) rows.push({ id: 'sizes', kind: 'values', values: sizes });
  return rows;
}

function policySections(policies: StorePolicies | null, locale: AppLocale): PolicySection[] {
  if (!policies) return [];
  const pairs = [
    ['delivery', policies.delivery, policies.deliveryEn],
    ['returns', policies.returns, policies.returnsEn],
  ] as const;
  return pairs.flatMap(([id, ar, en]) => {
    const text = localizedText(ar, en, locale);
    const paragraphs = text ? splitParagraphs(text.text) : [];
    return text && paragraphs.length > 0 ? [{ id, lang: text.lang, paragraphs }] : [];
  });
}

/**
 * Everything under Add to Bag ("In its chapter", 2026-09-26; it replaces the ED-4 tabs):
 * the facts list and the two folds, from real data only. `policies` is `null` when the
 * read failed.
 */
export function productInfo(
  product: CatalogProductDetail,
  policies: StorePolicies | null,
  locale: AppLocale
): ProductInfoModel {
  const description = localizedDescription(product, locale);
  const rest = description ? splitParagraphs(description.text).slice(1) : [];
  return {
    rows: detailsRows(product, locale),
    more: description && rest.length > 0 ? { lang: description.lang, paragraphs: rest } : null,
    shipping: policySections(policies, locale),
  };
}
