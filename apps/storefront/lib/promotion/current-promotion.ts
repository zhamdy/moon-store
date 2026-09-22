import type { EditorialSlot } from '@/lib/editorial/slots';

export interface Promotion {
  /** The photograph behind the banner. One slot: the banner is full-bleed at every width. */
  image: EditorialSlot;
  /**
   * `object-position`, written as complete class names so Tailwind's static scanner
   * finds them as whole candidate strings in this file.
   */
  imageClassName: string;
  /**
   * Where the banner's call to action sends a shopper. `/shop` is the whole catalogue,
   * which is honest here and only here: the offer applies across it, so there is no
   * sale collection to name. It is deliberately **not** listed in
   * `features/home/data/commerce-hrefs.test.ts` — that contract holds
   * `/shop/<category>` and `/collections/<slug>` to `REQUIRED_CATALOG_KEYS`, and
   * `/shop` names no key. Narrowing this to a category later means adding it there.
   */
  href: string;
}

/**
 * The one promotion running on the storefront, read by both surfaces that announce it:
 * the homepage banner (`components/promotion/promotion-banner.tsx`) and the slim bar
 * above the shop listings (`promotion-bar.tsx`). Running the next promotion is a data +
 * copy change — this record and the `promotion` namespace in both message catalogues.
 *
 * **Offer terms are the business's, not ours.** Amounts, dates, scope and conditions come
 * from them and are never written here to fill a slot. `promotion.terms` currently carries
 * a first draft of the buy-one-get-one conditions (2026-09-21) and is a launch blocker
 * until the business confirms the exact wording in both locales. Nothing on the storefront
 * applies a discount on its own either: there is no was-price on a product and no coupon
 * field in the bag, so whatever this announces has to be true at the till.
 *
 * Ending the promotion: drop `<PromotionBanner />` from `app/[locale]/page.tsx` and
 * `<PromotionBar />` from `features/catalog/components/catalog-page.tsx`.
 * `features/home/components/campaign/` is still here and still translated, so rendering
 * `<Campaign />` in the homepage slot puts the editorial pause back.
 */
export const currentPromotion: Promotion = {
  image: 'campaign',
  imageClassName: 'object-[72%_50%] md:object-center',
  href: '/shop',
};
