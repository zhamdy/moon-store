import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { formatPrice } from '../utils/price';
import { PurchasePanel } from './purchase-panel';

const TRANSLATED_KEYS = { size: 'size', color: 'color' } as const;

export interface PurchasePanelSlotProps {
  locale: AppLocale;
  product: CatalogProductDetail;
  /** The purchase action, composed by the page (this slice never imports `features/cart`). */
  action?: ReactNode;
}

/**
 * Server side of the purchase panel: resolves every string and formats every price the
 * island can show (the product price plus each distinct variant price), so the island
 * never formats numbers and its hydrated text cannot differ from the server's ICU output.
 */
export async function PurchasePanelSlot({ locale, product, action }: PurchasePanelSlotProps) {
  const [t, tp] = await Promise.all([
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'products' }),
  ]);
  const currency = tp('currency');

  const prices: Record<string, string> = {};
  for (const amount of [product.price, ...product.variants.map((variant) => variant.price)]) {
    prices[String(amount)] ??= formatPrice(amount, locale, currency);
  }

  const legends = Object.fromEntries(
    product.options.map((option) => {
      const known = TRANSLATED_KEYS[option.key as keyof typeof TRANSLATED_KEYS];
      return [
        option.key,
        known ? { text: t(`options.${known}`), staff: false } : { text: option.label, staff: true },
      ];
    })
  );

  return (
    <PurchasePanel
      product={{
        price: product.price,
        inStock: product.inStock,
        options: product.options,
        variants: product.variants,
      }}
      legends={legends}
      prices={prices}
      action={action}
      strings={{
        inStock: t('availability.inStock'),
        soldOut: t('availability.soldOut'),
        priceFrom: t.raw('priceFrom') as string,
        selected: t.raw('options.selected') as string,
        valueSoldOut: t.raw('options.valueSoldOut') as string,
        chooseOption: t.raw('chooseOption') as string,
      }}
    />
  );
}
