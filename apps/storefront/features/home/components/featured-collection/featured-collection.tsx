import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { editorialImages } from '@/lib/editorial/images';
import { collectionHref, homeCollections } from '../../data/home-collections';

/**
 * 05 - Featured collection (homepage Phase 2, 2026-09-25: the Claude Design board).
 *
 * **On Ivory now** (plan D4). It sat on Espresso straight after the Silk Edit, and at
 * 1440 the two read as one ~1,900px dark block that swallowed this section's padding.
 * The page's dark moments are now the hero, the Silk Edit and the campaign, never two
 * in a row.
 *
 * From 1024, on the 12-column grid: a 4:3 photograph in columns 1-7; the copy in 9-12
 * (column 8 is the pause); and a 4:5 detail in columns 6-8, bottom-aligned to the large
 * frame and pushed 40% of its own height below it, inside a 16px Ivory keyline so
 * the overlap reads as one layer laid on another. The grid's bottom padding makes room
 * for what hangs below. Below 1024 the overlap is kept but simplified: a 4:5 photograph
 * (4:3 on tablets), the detail pulled up over its inline-end corner at half the width,
 * then the copy (CSS `order`; the DOM keeps the copy second for reading order).
 *
 * Signature motion: the large frame's image wipe and settle, the title word by word,
 * the paragraph and link fading after it, and the detail drifting at its own speed on
 * scroll (element parallax, desktop only).
 */
export async function FeaturedCollection() {
  const t = await getTranslations('home.featured');

  return (
    <section aria-labelledby="featured-title" className="section-y overflow-hidden">
      <Container as="div">
        <Reveal className="grid-editorial gap-y-10 lg:pb-40" amount={0.2}>
          <div
            data-motion="image"
            className="relative isolate order-1 col-span-4 aspect-4/5 overflow-hidden rounded-media bg-surface-media md:col-span-8 md:aspect-4/3 lg:order-none lg:col-span-7 lg:col-start-1 lg:row-start-1"
          >
            <div data-motion-zoom="" className="absolute inset-0">
              <Image
                src={editorialImages['featured-large'].src}
                alt={t('largeAlt')}
                fill
                sizes="(min-width: 1440px) 780px, (min-width: 1024px) 56vw, 100vw"
                placeholder="blur"
                className="object-cover object-[28%_50%]"
              />
            </div>
          </div>

          <div className="order-3 col-span-4 md:col-span-6 lg:order-none lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:pt-10">
            <div
              aria-hidden="true"
              data-motion="fade"
              className="h-px w-12 bg-gold [--motion-offset:300ms]"
            />
            <TextReveal
              as="h2"
              id="featured-title"
              text={t('title')}
              offset={380}
              step={90}
              className="type-section-title mt-7 text-text"
            />
            <p
              data-motion="fade"
              className="type-body-lg measure mt-6 text-text-secondary [--motion-offset:680ms]"
            >
              {t('body')}
            </p>
            <div data-motion="fade" className="mt-8 [--motion-offset:800ms]">
              <EditorialLink href={collectionHref(homeCollections.featured)} underline="always">
                {t('link')}
              </EditorialLink>
            </div>
          </div>

          <Parallax
            mode="element"
            media="(min-width: 1024px)"
            travel={0.08}
            className="order-2 col-span-2 col-start-3 -mt-28 md:col-span-3 md:col-start-6 md:-mt-40 lg:order-none lg:col-span-3 lg:col-start-6 lg:row-start-1 lg:mt-0 lg:self-end"
          >
            {/* The keyline is padding on a wrapper, not an outline: the wipe's
                clip-path would cut an outline off. */}
            <div
              data-motion="fade"
              className="bg-bg p-2.5 [--motion-offset:500ms] lg:translate-y-[40%] lg:p-4"
            >
              <div
                data-motion="image"
                className="relative isolate aspect-4/5 overflow-hidden rounded-media bg-surface-media [--motion-offset:500ms]"
              >
                <Image
                  src={editorialImages['featured-small'].src}
                  alt={t('smallAlt')}
                  fill
                  sizes="(min-width: 1440px) 320px, (min-width: 1024px) 22vw, 60vw"
                  placeholder="blur"
                  className="object-cover"
                />
              </div>
            </div>
          </Parallax>
        </Reveal>
      </Container>
    </section>
  );
}
