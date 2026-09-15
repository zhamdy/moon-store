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

/** The info column's short lead: the first paragraph of the localized description. */
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

export type DetailsTab =
  | { id: 'description'; lang: AppLocale; paragraphs: string[] }
  | { id: 'details'; rows: DetailsRow[] }
  | { id: 'shipping'; sections: PolicySection[] };

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
 * The details section's tabs, in display order, from real data only (ED-4): a tab with
 * nothing to show is not in the list. `policies` is `null` when the read failed.
 */
export function productDetailsTabs(
  product: CatalogProductDetail,
  policies: StorePolicies | null,
  locale: AppLocale
): DetailsTab[] {
  const tabs: DetailsTab[] = [];

  const description = localizedDescription(product, locale);
  const paragraphs = description ? splitParagraphs(description.text) : [];
  if (description && paragraphs.length > 0) {
    tabs.push({ id: 'description', lang: description.lang, paragraphs });
  }

  const rows = detailsRows(product, locale);
  if (rows.length > 0) tabs.push({ id: 'details', rows });

  const sections = policySections(policies, locale);
  if (sections.length > 0) tabs.push({ id: 'shipping', sections });

  return tabs;
}

/** Whether a panel holds a focusable element; APG makes the panel itself a tab stop if not. */
export function tabHasFocusableContent(tab: DetailsTab): boolean {
  return tab.id === 'details' && tab.rows.some((row) => row.kind === 'links');
}
