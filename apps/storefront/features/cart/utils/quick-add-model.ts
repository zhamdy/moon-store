import type { AppLocale } from '@/i18n/routing';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import type {
  CatalogProductOption,
  CatalogProductVariant,
} from '@/features/products/types/catalog-product-detail';
import { localizedName, type LocalizedText } from '@/features/products/utils/localized-name';
import type { PurchaseReadiness } from '@/features/products/utils/variant-selection';

/**
 * What the product card's Quick Add needs from a listing DTO: the identity a bag line is
 * made of, the hint the bag shows until its quote arrives, and the *server-derived*
 * options and variants (`apps/server/CLAUDE.md` -> *Public catalog*). The card never
 * re-derives a variant rule; `features/products/utils/variant-selection.ts` decides
 * availability and readiness here exactly as it does on the product page.
 */
export interface QuickAddModel {
  slug: string;
  name: LocalizedText;
  /** The first catalog image, the add hint's thumbnail; never persisted. */
  imageUrl: string | null;
  /** The product's own price, the base a variant falls back to. */
  price: number;
  inStock: boolean;
  options: CatalogProductOption[];
  variants: CatalogProductVariant[];
}

export function toQuickAddModel(dto: CatalogProduct, locale: AppLocale): QuickAddModel {
  return {
    slug: dto.slug,
    name: localizedName(dto, locale),
    imageUrl: dto.images[0]?.url ?? null,
    price: dto.price,
    inStock: dto.inStock,
    options: dto.options,
    variants: dto.variants,
  };
}

/**
 * What one press of the card's Add to Bag does, from `purchaseReadiness` alone — the same
 * contract the product page's button reads (PD-B).
 *
 * `choose` is the card's own state and the reason Quick Add exists: a piece that needs a
 * size is never given one silently, and the panel asks for that one choice instead of
 * sending the shopper to the product page. A product whose options each have a single
 * value is already `ready`, so it adds on the first press with no panel.
 */
export type QuickAddPress = 'add' | 'choose' | 'soldOut';

export function quickAddPress(readiness: PurchaseReadiness): QuickAddPress {
  switch (readiness.kind) {
    case 'ready':
      return 'add';
    case 'needsSelection':
      return 'choose';
    case 'soldOut':
      return 'soldOut';
  }
}
