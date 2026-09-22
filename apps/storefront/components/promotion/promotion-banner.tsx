import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { EditorialLink } from '@/components/ui/editorial-link';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { Container } from '@/components/ui/container';
import { editorialImages } from '@/lib/editorial/images';
import { currentPromotion } from '@/lib/promotion/current-promotion';

/**
 * 07 - The running promotion, on the homepage, in the slot the campaign pause and then
 * the sale announcement held (user decisions, 2026-09-21). One full-bleed night
 * photograph, the offer at display size, the conditions under it and one way into the
 * shop. Its whole job is to tell a shopper what is on right now and where to spend it.
 *
 * It differs from the sale announcement it replaces in two ways, both deliberate: the
 * offer is **named** rather than implied ("Buy one, get one free", not "The Sale"), and
 * it **has a destination**. A named offer that applies across the catalogue makes
 * `/shop` the honest target; the reasoning, and what a narrower target would cost, is
 * on `currentPromotion.href`.
 *
 * Everything it says lives in the `promotion` namespace in both catalogues; the slot,
 * crop and destination live in `lib/promotion/current-promotion.ts`, which the shop
 * bar reads too — the two surfaces can never announce different offers.
 *
 * Composition follows the photograph, which is never mirrored: the figure stands in
 * the right third, so the copy is on the **physical left in both languages** at every
 * width, and each layout gets a straight gradient on that side only — a wash fading
 * inward from 768, a band rising from the floor below it. Straight, never diagonal,
 * and never a card.
 *
 * Two mechanics this page has been bitten by, both load-bearing:
 *
 * - The frame carries an explicit `w-full` beside its `md:max-h-[40rem]` cap. Once
 *   `max-height` binds, a box with an `aspect-ratio` holds the ratio by shrinking its
 *   **width**, and the photograph stops short of the viewport edge (CLAUDE.md →
 *   Learnings, 2026-09-21).
 * - Both copy measures are absolute, never `ch`. They sit on a wrapper, which inherits
 *   the body font at 16px, so a `ch` here would resolve in Inter rather than in the
 *   display face the headline is set in.
 *
 * `sizes` is height-driven below 768: a 21:9 source covering a tall portrait frame
 * needs about 2.33x the frame's height in pixel width, so a width-only `100vw` would
 * hand the browser an image far too small and the crop would soften.
 */
export async function PromotionBanner() {
  const t = await getTranslations('promotion');

  return (
    <section aria-labelledby="promotion-title" data-surface="dark" className="bg-dark-surface">
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
              src={editorialImages[currentPromotion.image].src}
              alt={t('imageAlt')}
              fill
              sizes="(min-width: 768px) 100vw, max(100vw, 190svh)"
              placeholder="blur"
              className={`object-cover ${currentPromotion.imageClassName}`}
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
                id="promotion-title"
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

              {/* The conditions read as small print on purpose: they qualify the offer,
                  they do not sell it. */}
              <p
                data-motion="fade"
                className="type-caption mt-4 max-w-[26rem] normal-case tracking-normal text-text-secondary [--motion-offset:860ms]"
              >
                {t('terms')}
              </p>

              <div data-motion="rise" className="mt-8 [--motion-offset:980ms] [--motion-rise:12px]">
                <EditorialLink
                  href={currentPromotion.href}
                  underline="always"
                  className="min-h-11 gap-4 pb-2 uppercase tracking-[0.12em] rtl:tracking-normal"
                >
                  {t('cta')}
                </EditorialLink>
              </div>
            </div>
          </Container>
        </div>
      </Reveal>
    </section>
  );
}
