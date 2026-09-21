import type { EditorialSlot } from '@/lib/editorial/slots';

export interface OfferBannerData {
  /** The photograph behind the offer. One slot: this section is full-bleed at every width. */
  image: EditorialSlot;
  /**
   * `object-position`, written as complete class names so Tailwind's static scanner
   * finds them as whole candidate strings in this file.
   */
  imageClassName: string;
}

/**
 * **No link (user decision, 2026-09-21).** There is no sale collection to send
 * anyone to, and a button that lands on the whole catalogue is not the sale. The
 * block announces the offer and nothing else; adding a destination later means a
 * `href` here, a `cta` key in both catalogues and the CTA block the component's
 * history already carries — and the href must name a `REQUIRED_CATALOG_KEYS` key,
 * which `features/home/data/commerce-hrefs.test.ts` and its server twin enforce.
 *
 * A terms line (dates, amounts, conditions) is a `home.offer.terms` key in both
 * catalogues plus three lines of JSX in the component. It does not exist yet and
 * must not be written to fill the slot: offer terms come from the business.
 *
 * The homepage offer block. Running a new promotion (Ramadan → Eid → end of season)
 * is a data + copy change: edit this record and `home.offer` in both message
 * catalogues. No component change.
 *
 * The photograph is the campaign slot, reused: it is the one night image on the page
 * and the section it replaced stood on it. `features/home/components/campaign/` is
 * still here and still translated — rendering `<Campaign />` in place of
 * `<OfferBanner />` in `app/[locale]/page.tsx` swaps the page back to the pause when
 * the promotion ends.
 */
export const offerBanner: OfferBannerData = {
  image: 'campaign',
  imageClassName: 'object-[72%_50%] md:object-center',
};
