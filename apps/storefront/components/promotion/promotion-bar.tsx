import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';
import { Reveal } from '@/components/motion/reveal';

/**
 * The running promotion, announced above the shop listings. The same offer as the
 * homepage banner and from the same record — a shopper who arrives straight on
 * `/shop` from search or a link never has to have seen the homepage to know it is on.
 *
 * Typographic, not photographic (owner decision, 2026-09-21): the listing below is a
 * grid of photographs, and a second full-bleed image above it would push the first row
 * of product below the fold on a phone. The offer, its conditions, and nothing else.
 *
 * **It carries no call to action.** It only ever renders on the pages it would send a
 * shopper to, so the link would be to the page they are already reading. The homepage
 * banner is the surface with a destination.
 *
 * Copy is the `promotion` namespace in both catalogues, shared with the banner, so the
 * two surfaces cannot drift apart. The `h2` is visually hidden: on a listing the offer
 * is an aside to the page's own `h1`, and a second visible heading above it would read
 * as the page's title.
 */
export async function PromotionBar() {
  const t = await getTranslations('promotion');

  return (
    <section aria-labelledby="promotion-bar-title" data-surface="dark" className="bg-dark-surface">
      <h2 id="promotion-bar-title" className="sr-only">
        {t('title')}
      </h2>
      <Reveal>
        <Container as="div" className="py-4 md:py-5">
          {/* The rule separates the offer from its conditions from 768 and disappears
              below it, where the two stack. */}
          <div className="flex flex-col items-start gap-1.5 md:flex-row md:items-baseline md:gap-4">
            <p
              data-motion="rise"
              aria-hidden="true"
              className="type-h4 text-balance text-text [--motion-offset:120ms] [--motion-rise:12px]"
            >
              {t('title')}
            </p>
            <span
              aria-hidden="true"
              data-motion="fade"
              className="hidden h-4 w-px shrink-0 bg-metallic [--motion-offset:240ms] md:block"
            />
            <p
              data-motion="fade"
              className="type-small text-text-secondary [--motion-offset:300ms]"
            >
              {t('terms')}
            </p>
          </div>
        </Container>
      </Reveal>
    </section>
  );
}
