import type { CSSProperties } from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Pause, Play } from 'lucide-react';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import { editorialStripItems } from '../../data/editorial-strip';
import { Marquee } from './marquee';

/** The frame's rendered width at its largest (164px tall, 4:5), over-scaled by the pan. */
const STRIP_IMAGE_SIZES = '160px';

/**
 * 02 - Moving editorial strip. Collection words in display type crossing the Sand
 * band between small square-cornered 4:5 details; the only marquee on the page. The
 * images are decorative (`alt=""`) because the words name the collections.
 *
 * Homepage Phase 2 (2026-09-25, the Claude Design board):
 *
 * - Words alternate upright and italic in English (Instrument Serif's italic is a real
 *   face); Arabic stays upright, since Amiri's italic is not part of the design system.
 * - The frames scale with the band — 112px tall on phones, 164px from 1024 — rather
 *   than a fixed 180px, so on a phone the words no longer dominate the viewport.
 * - **A visible Pause / Play control** at the band's inline end closes the WCAG 2.2.2
 *   gap the 2026-09-14 removal left open (plan D7). It is CSS-only, no client
 *   boundary: a real checkbox (`data-strip-toggle`, named "Pause motion") whose label
 *   is drawn as a pill, and `[data-strip]:has([data-strip-toggle]:checked)` stops the
 *   marquee and the in-frame pan (app/globals.css → *Marquee*). Hover and focus still
 *   pause as before; reduced motion still removes the motion and the control with it.
 */
export async function EditorialStrip() {
  const t = await getTranslations('home.strip');
  const imageOrder = new Map(
    editorialStripItems
      .flatMap((item, index) => (item.kind === 'image' ? [index] : []))
      .map((itemIndex, order) => [itemIndex, order])
  );
  let wordOrder = 0;

  return (
    <section
      data-strip=""
      data-surface="sand"
      aria-labelledby="strip-heading"
      className="relative bg-bg py-8 lg:py-[2.375rem]"
    >
      <h2 id="strip-heading" className="sr-only">
        {t('heading')}
      </h2>
      <Marquee duration={40} gap="clamp(2rem, 3.5vw, 3.5rem)">
        {editorialStripItems.map((item, index) => {
          if (item.kind === 'word') {
            const italic = wordOrder++ % 2 === 0;
            return (
              <span
                key={index}
                className={cn(
                  'type-display whitespace-nowrap text-text',
                  italic && 'italic rtl:not-italic'
                )}
              >
                {t(`words.${item.messageKey}`)}
              </span>
            );
          }
          return (
            <span
              key={index}
              className="relative isolate block aspect-4/5 h-28 shrink-0 overflow-hidden rounded-media bg-surface-media lg:h-41"
            >
              <Image
                src={editorialImages[item.slot].src}
                alt=""
                fill
                sizes={STRIP_IMAGE_SIZES}
                placeholder="blur"
                data-strip-pan=""
                style={
                  { '--pan-delay': `${-2.5 * (imageOrder.get(index) ?? 0)}s` } as CSSProperties
                }
                className="object-cover"
              />
            </span>
          );
        })}
      </Marquee>

      {/* The inline-end fade the control sits on, and the control itself. */}
      <div
        aria-hidden="true"
        data-strip-control=""
        className="pointer-events-none absolute inset-y-0 end-0 w-56 bg-linear-to-r from-transparent to-bg to-55% rtl:bg-linear-to-l lg:w-72"
      />
      <div
        data-strip-control=""
        className="absolute inset-y-0 end-(--page-gutter) flex items-center"
      >
        <input
          id="strip-toggle"
          type="checkbox"
          data-strip-toggle=""
          aria-label={t('pauseMotion')}
          className="peer sr-only"
        />
        <label
          htmlFor="strip-toggle"
          className="type-label flex min-h-(--size-tap) cursor-pointer items-center gap-2.5 rounded-pill border border-text/30 bg-bg ps-3 pe-4 text-text transition-colors duration-fast ease-ui hover:border-text [&_[data-when=paused]]:hidden peer-checked:[&_[data-when=paused]]:inline-flex peer-checked:[&_[data-when=running]]:hidden"
        >
          <span data-when="running" aria-hidden="true" className="inline-flex items-center gap-2.5">
            <Pause size={12} strokeWidth={1.5} fill="currentColor" />
            {t('pause')}
          </span>
          <span data-when="paused" aria-hidden="true" className="items-center gap-2.5">
            <Play size={12} strokeWidth={1.5} fill="currentColor" />
            {t('play')}
          </span>
        </label>
      </div>
    </section>
  );
}
