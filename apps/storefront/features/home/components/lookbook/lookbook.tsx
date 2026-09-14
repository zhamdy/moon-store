import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Container } from '@/components/ui/container';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import { lookbookItems } from '../../data/lookbook';

/** Desktop mosaic placement per item: column span plus a vertical offset. */
const MOSAIC = [
  'lg:col-start-1 lg:col-end-5',
  'lg:col-start-5 lg:col-end-8 lg:mt-24 lg:self-end',
  'lg:col-start-8 lg:col-end-13',
  'lg:col-start-2 lg:col-end-6 lg:-mt-16',
  'lg:col-start-8 lg:col-end-11 lg:mt-12',
];

/** Desktop scroll travel per item. Signed, so neighbours drift apart and the mosaic reads as layered. */
const TRAVEL = [0.05, -0.04, 0.07, -0.03, 0.05];

/**
 * Rendered width per mosaic item, derived from its MOSAIC column span (12-column
 * grid, lg:gap-8) against `--container-max`/`--page-gutter` at each breakpoint.
 * Index 2 (5 columns) was previously under `sizes` by roughly half at 1440 (460px
 * vs the ~528px it actually renders at).
 */
const SIZES = [
  '(min-width: 1440px) 416px, (min-width: 1024px) 288px, 78vw',
  '(min-width: 1440px) 304px, (min-width: 1024px) 208px, 78vw',
  '(min-width: 1440px) 528px, (min-width: 1024px) 368px, 78vw',
  '(min-width: 1440px) 416px, (min-width: 1024px) 288px, 78vw',
  '(min-width: 1440px) 304px, (min-width: 1024px) 208px, 78vw',
];

/**
 * 10 - Lookbook. Five images with varied ratios on the 12-column grid from 1024,
 * staggered so the mosaic reads as a spread rather than a row; below that a
 * scroll-snap rail at ~78vw so the next image peeks. The rail is a focusable
 * labelled region because it contains no focusable children: Safari and Firefox do
 * not make scrollers keyboard-reachable on their own. No handles, captions or
 * social chrome.
 *
 * From 1024 each image travels with the scroll at its own rate, some with it and
 * some against it. The rail has no scroll motion: the swipe is the motion there.
 *
 * No scroll reveal on the images: inside the horizontal rail, cards off to the
 * side never intersect until swiped, so they arrived blank and faded in mid-swipe.
 */
export async function Lookbook() {
  const t = await getTranslations('home.lookbook');

  return (
    <Container as="section" aria-labelledby="lookbook-title" className="section-y">
      <h2 id="lookbook-title" className="sr-only">
        {t('heading')}
      </h2>
      <div
        role="region"
        aria-label={t('heading')}
        // Accepted: from 1024 this is no longer a scroller (the mosaic grid has
        // no overflow), so this tabIndex is one extra, labelled stop rather than
        // a functional one. CSS cannot change tabindex, and the only no-JS
        // alternative is rendering the mosaic twice (two DOM trees, ten Parallax
        // instances, duplicated alt) for a small a11y gain.
        tabIndex={0}
        className={cn(
          '-mx-(--page-gutter) flex snap-x snap-mandatory gap-4 overflow-x-auto px-(--page-gutter) pb-2 [scrollbar-width:none]',
          'lg:mx-0 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 lg:overflow-visible lg:px-0 lg:pb-0'
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
            <figure className={cn('relative bg-surface-soft', item.aspect)}>
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
  );
}
