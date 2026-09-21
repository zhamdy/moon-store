import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { Container } from '@/components/ui/container';
import { offerBanner } from '@/features/home/data/offer-banner';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 07 - Offer: the homepage's sale announcement, in the slot the campaign pause used
 * to hold (user decision, 2026-09-21). One full-bleed night photograph, the offer at
 * display size and one line under it. Its whole job is to tell a shopper a sale is
 * running right now.
 *
 * **It is an announcement, not a collection block, and it has no link** (user
 * decision, 2026-09-21): there is no sale collection to send anyone to, and a button
 * that lands on the whole catalogue is not the sale. What it takes to add one later
 * is in `features/home/data/offer-banner.ts`.
 *
 * Everything it says lives in `home.offer` in both message catalogues; the slot and
 * crop live in that same data record. Running the next promotion is a data + copy
 * change, never a component change, and `features/home/components/campaign/` is
 * still here and still translated — rendering `<Campaign />` instead of this one in
 * `app/[locale]/page.tsx` puts the pause back when the promotion ends.
 *
 * **Offer terms are the business's, not ours.** Amounts, dates and conditions come
 * from them and are never written here to fill a slot, which is why the copy states
 * no percentage and no end date — put the real ones in `home.offer` in both
 * catalogues. A terms line is a `home.offer.terms` key plus three lines of JSX here;
 * next-intl types the catalogue, so the slot cannot be left open against a key that
 * does not exist. Nothing on the storefront applies a discount on its own either:
 * there is no was-price on a product and no coupon field in the bag, so whatever
 * this announces has to be true in the catalog.
 *
 * Composition follows the photograph, which is never mirrored: the figure stands in
 * the right third, so the copy is on the **physical left in both languages** at
 * every width, and each layout gets a straight gradient on that side only — a wash
 * fading inward from 768, a band rising from the floor below it. Straight, never
 * diagonal, and never a card.
 *
 * Two mechanics this page has been bitten by, both load-bearing:
 *
 * - The frame carries an explicit `w-full` beside its `md:max-h-[40rem]` cap. Once
 *   `max-height` binds, a box with an `aspect-ratio` holds the ratio by shrinking
 *   its **width**, and the photograph stops short of the viewport edge (CLAUDE.md →
 *   Learnings, 2026-09-21).
 * - Both copy measures are absolute, never `ch`. They sit on a wrapper, which
 *   inherits the body font at 16px, so a `ch` here would resolve in Inter rather
 *   than in the display face the headline is set in.
 *
 * `sizes` is height-driven below 768: a 21:9 source covering a tall portrait frame
 * needs about 2.33x the frame's height in pixel width, so a width-only `100vw`
 * would hand the browser an image far too small and the crop would soften.
 */
export async function OfferBanner() {
  const t = await getTranslations('home.offer');

  return (
    <section aria-labelledby="offer-title" data-surface="dark" className="bg-dark-surface">
      <Reveal className="relative isolate" amount={0.35}>
        <Parallax
          travel={0.06}
          className="relative z-0 h-[80svh] min-h-[32rem] w-full md:h-auto md:aspect-[21/9] md:max-h-[40rem]"
        >
          <div
            data-motion-zoom=""
            className="absolute inset-0 [--motion-duration:1800ms] [--motion-zoom:1.05]"
          >
            <Image
              src={editorialImages[offerBanner.image].src}
              alt={t('imageAlt')}
              fill
              sizes="(min-width: 768px) 100vw, max(100vw, 190svh)"
              placeholder="blur"
              className={`object-cover ${offerBanner.imageClassName}`}
            />
          </div>
        </Parallax>

        {/* Below 768: a band rising from the floor the copy stands on. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-linear-to-t from-dark-surface/94 from-0% via-dark-surface/64 via-46% to-transparent to-84% md:hidden"
        />
        {/* 768+: a wash fading inward from the copy edge, the figure's side untouched.
            Physical, so it does not mirror under RTL. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-3/5 bg-linear-to-r from-dark-surface/90 from-0% via-dark-surface/50 via-45% to-transparent md:block"
        />

        <div className="absolute inset-0 z-20 flex items-end">
          <Container as="div" className="w-full pb-12 md:pb-16">
            {/* Under RTL, margin-inline-start: auto keeps the block on the physical left. */}
            <div className="max-w-[20rem] md:max-w-[30rem] rtl:ms-auto">
              <div
                aria-hidden="true"
                data-motion="fade"
                className="h-px w-10 bg-metallic [--motion-offset:180ms]"
              />

              <TextReveal
                as="h2"
                id="offer-title"
                text={t('title')}
                offset={380}
                step={100}
                duration={1000}
                className="mt-6 type-h1 md:type-display text-balance text-text"
              />

              <p
                data-motion="rise"
                className="type-body-lg mt-5 text-text-secondary [--motion-offset:720ms] [--motion-rise:24px]"
              >
                {t('body')}
              </p>
            </div>
          </Container>
        </div>
      </Reveal>
    </section>
  );
}
