import type {
  CatalogProductDetail,
  CatalogProductOption,
  CatalogProductVariant,
} from '../types/catalog-product-detail';

export type PurchaseProduct = Pick<
  CatalogProductDetail,
  'price' | 'inStock' | 'options' | 'variants'
>;

/** Option key to the chosen value; `null` (or a missing key) is unselected. */
export type Selection = Record<string, string | null>;

export type DisplayedPrice = { kind: 'exact'; price: number } | { kind: 'from'; price: number };

export type AvailabilityStatus = 'inStock' | 'soldOut' | 'none';

export type PurchaseReadiness =
  | { kind: 'soldOut' }
  | { kind: 'needsSelection'; keys: string[] }
  | { kind: 'ready'; options: Record<string, string> };

export function initialSelection(options: CatalogProductOption[]): Selection {
  const selection: Selection = {};
  for (const option of options) {
    selection[option.key] = option.values.length === 1 ? option.values[0]! : null;
  }
  return selection;
}

export function valueAvailable(
  key: string,
  value: string,
  selection: Selection,
  variants: CatalogProductVariant[]
): boolean {
  return variants.some(
    (variant) =>
      variant.inStock &&
      variant.options[key] === value &&
      Object.entries(selection).every(
        ([otherKey, chosen]) =>
          otherKey === key || chosen == null || variant.options[otherKey] === chosen
      )
  );
}

function unselectedKeys(selection: Selection, product: PurchaseProduct): string[] {
  return product.options.map((option) => option.key).filter((key) => selection[key] == null);
}

export function selectedVariant(
  selection: Selection,
  product: PurchaseProduct
): CatalogProductVariant | null {
  if (product.options.length === 0 || unselectedKeys(selection, product).length > 0) return null;
  return (
    product.variants.find((variant) =>
      product.options.every((option) => variant.options[option.key] === selection[option.key])
    ) ?? null
  );
}

export function displayedPrice(selection: Selection, product: PurchaseProduct): DisplayedPrice {
  const selected = selectedVariant(selection, product);
  if (selected) return { kind: 'exact', price: selected.price };
  if (product.variants.length === 0) return { kind: 'exact', price: product.price };
  const prices = product.variants.map((variant) => variant.price);
  const min = Math.min(...prices);
  return prices.every((price) => price === min)
    ? { kind: 'exact', price: min }
    : { kind: 'from', price: min };
}

export function availabilityStatus(
  selection: Selection,
  product: PurchaseProduct
): AvailabilityStatus {
  const selected = selectedVariant(selection, product);
  if (selected) return selected.inStock ? 'inStock' : 'soldOut';
  return product.inStock ? 'none' : 'soldOut';
}

/** The Cart contract (PD-B). */
export function purchaseReadiness(
  selection: Selection,
  product: PurchaseProduct
): PurchaseReadiness {
  if (!product.inStock) return { kind: 'soldOut' };
  if (product.options.length === 0) return { kind: 'ready', options: {} };
  const keys = unselectedKeys(selection, product);
  if (keys.length > 0) return { kind: 'needsSelection', keys };
  const selected = selectedVariant(selection, product);
  // A full selection with no matching variant is a combination that cannot be bought.
  if (!selected?.inStock) return { kind: 'soldOut' };
  return { kind: 'ready', options: { ...selected.options } };
}
