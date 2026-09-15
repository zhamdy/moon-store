import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import type { PluralTemplates } from './plural-templates';

/**
 * Server-side builders of the resolved strings the bag islands take as props, so no
 * client component receives the message catalogue. `{name}`-style values are raw
 * templates filled on the client with `fillTemplate`; counts go through `selectPlural`.
 * Import only the types from client code.
 */

export interface AddToBagStrings {
  addToBag: string;
  soldOut: string;
  /** `{name}`: the drawer description fixed at an `added` opening (CD-13). */
  added: string;
  /** `{max}` */
  capped: string;
  full: string;
}

export interface BagTriggerStrings {
  /** The link's name when the bag is empty or not hydrated. */
  label: string;
  /** "Bag, {count} items", per plural category (CD-18). */
  count: PluralTemplates;
}

export interface BagLineStrings {
  /** `{name}` */
  quantity: string;
  /** `{name}` */
  increase: string;
  /** `{name}` */
  decrease: string;
  remove: string;
  /** `{name}` */
  removeLabel: string;
  /** `{label}: {value}` */
  optionValue: string;
  /** Labels for option keys the storefront translates; other keys use the server label. */
  optionLabels: { size: string; color: string };
  unitPrice: string;
  lineTotal: string;
  unavailablePiece: string;
  justAdded: string;
  currency: string;
  notice: {
    soldOut: string;
    variantUnavailable: string;
    productUnavailable: string;
    /** `{count}` */
    quantityLimited: string;
    priceUpdated: string;
    /** `{max}` */
    capped: string;
  };
}

export interface BagSummaryStrings {
  heading: string;
  subtotal: string;
  updating: string;
  pieces: PluralTemplates;
  piecesInBag: PluralTemplates;
  excluded: PluralTemplates;
  continueShopping: string;
}

export interface BagStatusStrings {
  emptyTitle: string;
  emptyAction: string;
  errorLoad: string;
  retry: string;
  emptyBag: string;
}

export interface BagAnnouncementStrings {
  /** `{name}, {count}, {subtotal}` */
  quantityChanged: string;
  /** `{name}` */
  removed: string;
  updated: string;
  issues: {
    unavailable: PluralTemplates;
    limited: PluralTemplates;
    priceUpdated: PluralTemplates;
  };
  errorLoad: string;
}

export interface BagDrawerStrings {
  title: string;
  close: string;
  viewBag: string;
  continueShopping: string;
  line: BagLineStrings;
  summary: BagSummaryStrings;
  status: BagStatusStrings;
  announcements: BagAnnouncementStrings;
}

export interface BagPageStrings {
  title: string;
  line: BagLineStrings;
  summary: BagSummaryStrings;
  status: BagStatusStrings;
  announcements: BagAnnouncementStrings;
}

type BagTranslator = Awaited<ReturnType<typeof getTranslations<'bag'>>>;
type PluralKey =
  | 'count'
  | 'pieces'
  | 'piecesInBag'
  | 'excluded'
  | 'issues.unavailable'
  | 'issues.limited'
  | 'issues.priceUpdated';

/** Every plural family `plural()` reads, pinned against both catalogues by bag-strings.test.ts. */
export const PLURAL_KEYS = [
  'count',
  'pieces',
  'piecesInBag',
  'excluded',
  'issues.unavailable',
  'issues.limited',
  'issues.priceUpdated',
] as const satisfies readonly PluralKey[];

// Fails typecheck when a PluralKey is added without listing it above.
type UnlistedPluralKey = Exclude<PluralKey, (typeof PLURAL_KEYS)[number]>;
const pluralKeysComplete: UnlistedPluralKey extends never ? true : never = true;
void pluralKeysComplete;

function plural(t: BagTranslator, key: PluralKey): PluralTemplates {
  // next-intl types `raw` for leaf keys only; a plural family is an object of six leaves
  // (messages.test.ts guarantees both locales carry all six).
  return (t.raw as (key: string) => unknown)(key) as PluralTemplates;
}

function bagTranslations(locale: AppLocale): Promise<BagTranslator> {
  return getTranslations({ locale, namespace: 'bag' });
}

export async function getAddToBagStrings(locale: AppLocale): Promise<AddToBagStrings> {
  const [t, tp] = await Promise.all([
    bagTranslations(locale),
    getTranslations({ locale, namespace: 'product' }),
  ]);
  return {
    addToBag: tp('addToBag'),
    soldOut: tp('availability.soldOut'),
    added: t.raw('added') as string,
    capped: t.raw('notice.capped') as string,
    full: t('notice.full'),
  };
}

export async function getBagTriggerStrings(locale: AppLocale): Promise<BagTriggerStrings> {
  const [t, tn] = await Promise.all([
    bagTranslations(locale),
    getTranslations({ locale, namespace: 'navigation' }),
  ]);
  return { label: tn('bag'), count: plural(t, 'count') };
}

async function sharedBagStrings(locale: AppLocale) {
  const [t, tp, tProducts] = await Promise.all([
    bagTranslations(locale),
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'products' }),
  ]);

  const line: BagLineStrings = {
    quantity: t.raw('quantity') as string,
    increase: t.raw('increase') as string,
    decrease: t.raw('decrease') as string,
    remove: t('remove'),
    removeLabel: t.raw('removeLabel') as string,
    optionValue: t.raw('optionValue') as string,
    optionLabels: { size: tp('options.size'), color: tp('options.color') },
    unitPrice: t('unitPrice'),
    lineTotal: t('lineTotal'),
    unavailablePiece: t('unavailablePiece'),
    justAdded: t('justAdded'),
    currency: tProducts('currency'),
    notice: {
      soldOut: t('notice.soldOut'),
      variantUnavailable: t('notice.variantUnavailable'),
      productUnavailable: t('notice.productUnavailable'),
      quantityLimited: t.raw('notice.quantityLimited') as string,
      priceUpdated: t('notice.priceUpdated'),
      capped: t.raw('notice.capped') as string,
    },
  };

  const summary: BagSummaryStrings = {
    heading: t('summaryHeading'),
    subtotal: t('subtotal'),
    updating: t('updating'),
    pieces: plural(t, 'pieces'),
    piecesInBag: plural(t, 'piecesInBag'),
    excluded: plural(t, 'excluded'),
    continueShopping: t('continueShopping'),
  };

  const status: BagStatusStrings = {
    emptyTitle: t('empty.title'),
    emptyAction: t('empty.action'),
    errorLoad: t('error.load'),
    retry: t('error.retry'),
    emptyBag: t('error.emptyBag'),
  };

  const announcements: BagAnnouncementStrings = {
    quantityChanged: t.raw('quantityChanged') as string,
    removed: t.raw('removed') as string,
    updated: t('updated'),
    issues: {
      unavailable: plural(t, 'issues.unavailable'),
      limited: plural(t, 'issues.limited'),
      priceUpdated: plural(t, 'issues.priceUpdated'),
    },
    errorLoad: t('error.load'),
  };

  return { t, line, summary, status, announcements };
}

export async function getBagDrawerStrings(locale: AppLocale): Promise<BagDrawerStrings> {
  const { t, ...shared } = await sharedBagStrings(locale);
  return {
    title: t('title'),
    close: t('close'),
    viewBag: t('viewBag'),
    continueShopping: t('continueShopping'),
    ...shared,
  };
}

export async function getBagPageStrings(locale: AppLocale): Promise<BagPageStrings> {
  const { t, ...shared } = await sharedBagStrings(locale);
  return { title: t('title'), ...shared };
}

/** Metadata for `/bag` (the page itself sets `noindex`). */
export async function getBagMetadataStrings(
  locale: AppLocale
): Promise<{ title: string; description: string }> {
  const t = await bagTranslations(locale);
  return { title: t('metaTitle'), description: t('metaDescription') };
}
