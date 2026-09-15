import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { getBagPageStrings, type BagPageStrings } from '@/features/cart/utils/bag-strings';
import {
  CHECKOUT_ERROR_KEYS,
  CHECKOUT_FIELDS,
  type CheckoutErrorKey,
  type CheckoutField,
} from '../schemas/checkout-form';

/**
 * Server-side builders of the resolved strings the checkout island takes as props, so no
 * client component receives the message catalogue. `{name}`-style values stay raw templates,
 * filled on the client with `fillTemplate`. Import only the types from client code.
 */

export interface CheckoutPageStrings {
  title: string;
  backToBag: string;
  sections: { contact: string; address: string; delivery: string };
  optional: string;
  fields: Record<CheckoutField, string>;
  hints: Partial<Record<CheckoutField, string>>;
  /** `tooLong` is a `{max}` template. */
  errors: Record<CheckoutErrorKey, string>;
  delivery: { pending: string };
  summary: {
    heading: string;
    /** `{pieces}`, `{subtotal}` */
    toggle: string;
    lines: string;
    /** `{count}` */
    quantity: string;
    delivery: string;
    deliveryLater: string;
    editBag: string;
  };
  notice: {
    checking: string;
    /** `{names}` */
    blockedBody: string;
    priceUpdatedBody: string;
    failed: string;
    rejected: string;
    returnToBag: string;
    tryAgain: string;
  };
  action: { continue: string; checking: string };
  /** Development and preview QA copy only (CO-15, CO-22); never production copy. */
  outcome: { unavailablePreview: string; backToBag: string; continueShopping: string };
  /** The bag's line, summary, status and announcement strings the summary reuses. */
  bag: BagPageStrings;
}

type CheckoutTranslator = Awaited<ReturnType<typeof getTranslations<'checkout'>>>;

function raw(t: CheckoutTranslator, key: string): string {
  // Templates keep their `{placeholders}` for the client; next-intl types `raw` loosely.
  return (t.raw as (key: string) => unknown)(key) as string;
}

export async function getCheckoutPageStrings(locale: AppLocale): Promise<CheckoutPageStrings> {
  const [t, bag] = await Promise.all([
    getTranslations({ locale, namespace: 'checkout' }),
    getBagPageStrings(locale),
  ]);

  return {
    title: t('title'),
    backToBag: t('backToBag'),
    sections: {
      contact: t('sections.contact'),
      address: t('sections.address'),
      delivery: t('sections.delivery'),
    },
    optional: t('optional'),
    fields: Object.fromEntries(
      CHECKOUT_FIELDS.map((field) => [field, t(`fields.${field}`)])
    ) as Record<CheckoutField, string>,
    hints: { street: t('hints.street') },
    errors: Object.fromEntries(
      CHECKOUT_ERROR_KEYS.map((key) => [key, raw(t, `errors.${key}`)])
    ) as Record<CheckoutErrorKey, string>,
    delivery: { pending: t('delivery.pending') },
    summary: {
      heading: t('summary.heading'),
      toggle: raw(t, 'summary.toggle'),
      lines: t('summary.lines'),
      quantity: raw(t, 'summary.quantity'),
      delivery: t('summary.delivery'),
      deliveryLater: t('summary.deliveryLater'),
      editBag: t('summary.editBag'),
    },
    notice: {
      checking: t('notice.checking'),
      blockedBody: raw(t, 'notice.blockedBody'),
      priceUpdatedBody: t('notice.priceUpdatedBody'),
      failed: t('notice.failed'),
      rejected: t('notice.rejected'),
      returnToBag: t('notice.returnToBag'),
      tryAgain: t('notice.tryAgain'),
    },
    action: { continue: t('action.continue'), checking: t('action.checking') },
    outcome: {
      unavailablePreview: t('outcome.unavailablePreview'),
      backToBag: t('outcome.backToBag'),
      continueShopping: t('outcome.continueShopping'),
    },
    bag,
  };
}

/** Metadata for `/checkout` (the page itself sets `noindex`). */
export async function getCheckoutMetadataStrings(
  locale: AppLocale
): Promise<{ title: string; description: string }> {
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}
