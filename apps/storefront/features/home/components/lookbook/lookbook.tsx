import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { SectionHeader } from '@/components/ui/section-header';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import { lookbookItems } from '../../data/lookbook';

/** Desktop mosaic placement per item: column span plus a vertical offset. */
const MOSAIC = [
  'lg:col-start-1 lg:col-end-5 lg:row-start-1 lg:mt-10',
  'lg:col-start-5 lg:col-end-8 lg:row-start-1 lg:mt-45',
  'lg:col-start-8 lg:col-end-13 lg:row-start-1',
  'lg:col-start-2 lg:col-end-5 lg:row-start-2 lg:-mt-40',
  'lg:col-start-6 lg:col-end-8 lg:row-start-2 lg:mt-4',
];

/** Desktop scroll travel per item. Signed, so neighbours drift apart and the mosaic reads as layered. */
const TRAVEL = [0.05, -0.04, 0.07, -0.03, 0.05];

/**
 * Rendered width per mosaic item, derived from its MOSAIC column span (12-column
 * grid, 24px gaps) against `--container-max` / `--page-gutter`.
 */
const SIZES = [
  '(min-width: 1440px) 424px, (min-width: 1024px) 29vw, 78vw',
  '(min-width: 1440px) 312px, (min-width: 1024px) 22vw, 78vw',
  '(min-width: 1440px) 536px, (min-width: 1024px) 37vw, 78vw',
  '(min-width: 1440px) 312px, (min-width: 1024px) 22vw, 78vw',
  '(min-width: 1440px) 200px, (min-width: 1024px) 14vw, 78vw',
];

/**
 * 10 - Lookbook, the page's closing signature (homepage Phase 2, 2026-09-25: the Claude
 * Design board). It now opens with a visible header (plan D8) — the "Worn by Moon"
 * eyebrow, "Lookbook" at display size and one line of lead — so the page no longer
 * ends on five unlabelled photographs. There is no lookbook route, so no link.
 *
 * From 1024: five frames on the 12-column grid in two stepped rows, each travelling
 * with the scroll at its own signed rate (element parallax), and an Espresso band under
 * the lower row that runs straight into the footer, so the last two frames straddle
 * Ivory and Espresso and carry the eye down. Below 1024: a scroll-snap rail at 78vw so
 * the next image peeks, a focusable labelled region (it has no focusable children, and
 * Safari and Firefox do not make scrollers keyboard-reachable on their own), with no
 * scroll motion — the swipe is the motion there.
 *
 * No scroll reveal on the images: inside the horizontal rail, cards off to the side
 * never intersect until swiped, so they arrived blank and faded in mid-swipe.
 */
export async function Lookbook() {
  const t = await getTranslations('home.lookbook');

  return (
    <section
      aria-labelledby="lookbook-title"
      className="relative isolate pt-(--section-space) pb-(--section-space) lg:pb-0"
    >
      {/* The Espresso band the lower row straddles, meeting the footer. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 hidden h-64 bg-espresso lg:block"
      />
      <Container as="div">
        <Reveal>
          <SectionHeader
            id="lookbook-title"
            layout="split"
            size="display"
            motion="editorial"
            eyebrow={t('eyebrow')}
            title={t('heading')}
            lead={t('lead')}
          />
        </Reveal>
        <div
          role="region"
          aria-label={t('heading')}
          // Accepted: from 1024 this is no longer a scroller (the mosaic grid has
          // no overflow), so this tabIndex is one extra, labelled stop rather than
          // a functional one.
          tabIndex={0}
          className={cn(
            '-mx-(--page-gutter) flex snap-x snap-mandatory gap-4 overflow-x-auto px-(--page-gutter) pb-2 [scrollbar-width:none]',
            'lg:mx-0 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-6 lg:gap-y-0 lg:overflow-visible lg:px-0 lg:pb-12'
          )}
        >
          {lookbookItems.map((item, index) => (
            <Parallax
              key={item.slot}
              mode="element"
              media="(min-width: 1024px)"
              travel={TRAVEL[index % TRAVEL.length]}
              className={cn('w-[78vw] shrink-0 snap-start lg:w-auto', MOSAIC[index])}
            >
              <figure
                className={cn(
                  'relative overflow-hidden rounded-media bg-surface-media',
                  item.aspect
                )}
              >
                <Image
                  src={editorialImages[item.slot].src}
                  alt={t(item.altKey)}
                  fill
                  sizes={SIZES[index % SIZES.length]}
                  placeholder="blur"
                  className="object-cover"
                />
              </figure>
            </Parallax>
          ))}
        </div>
      </Container>
    </section>
  );
}
