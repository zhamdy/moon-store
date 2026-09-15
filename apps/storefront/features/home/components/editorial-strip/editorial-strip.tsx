import type { CSSProperties } from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { editorialImages } from '@/lib/editorial/images';
import { editorialStripItems } from '../../data/editorial-strip';
import { Marquee } from './marquee';

const STRIP_IMAGE_HEIGHT = 180;
const STRIP_IMAGE_WIDTH = Math.round((STRIP_IMAGE_HEIGHT * 3) / 4);
/** The photograph is over-scaled inside its frame so it can drift without exposing an edge. */
const PAN_SCALE = 1.18;

/**
 * 02 - Moving editorial strip. Collection words in display type crossing the
 * screen between small portrait details, on the cream band that carries the page
 * from the dark hero into the ivory sections. The only marquee on the page; the
 * images are decorative (`alt=""`) because the words name the collections.
 *
 * Words and details stay in one line, in the order they alternate (user feedback,
 * 2026-09-14: floating the images over the words as a separate faster layer read
 * as clutter). Depth comes from inside each frame instead: the photograph drifts
 * slowly sideways on its own cycle, so the images move at a different speed from
 * the words without leaving their place. Offset start times keep neighbouring
 * frames out of step. Hover pauses both; reduced motion stops both.
 *
 * No visible pause control (user decision, 2026-09-14): the toggle was removed, so
 * keyboard and touch users have no way to stop the motion. That is an open WCAG
 * 2.2.2 gap, recorded in docs/ACCESSIBILITY.md -> Known gaps.
 */
export async function EditorialStrip() {
  const t = await getTranslations('home.strip');
  const imageOrder = new Map(
    editorialStripItems
      .flatMap((item, index) => (item.kind === 'image' ? [index] : []))
      .map((itemIndex, order) => [itemIndex, order])
  );

  return (
    <section
      data-strip=""
      aria-labelledby="strip-heading"
      className="bg-surface-soft py-10 lg:py-14"
    >
      <h2 id="strip-heading" className="sr-only">
        {t('heading')}
      </h2>
      <Marquee duration={34}>
        {editorialStripItems.map((item, index) =>
          item.kind === 'word' ? (
            <span key={index} className="type-display whitespace-nowrap text-text">
              {t(`words.${item.messageKey}`)}
            </span>
          ) : (
            <span
              key={index}
              className="relative isolate block shrink-0 overflow-hidden rounded-media"
              style={{ width: STRIP_IMAGE_WIDTH, height: STRIP_IMAGE_HEIGHT }}
            >
              <Image
                src={editorialImages[item.slot].src}
                alt=""
                width={STRIP_IMAGE_WIDTH}
                height={STRIP_IMAGE_HEIGHT}
                sizes={`${Math.ceil(STRIP_IMAGE_WIDTH * PAN_SCALE)}px`}
                placeholder="blur"
                data-strip-pan=""
                style={
                  { '--pan-delay': `${-2.5 * (imageOrder.get(index) ?? 0)}s` } as CSSProperties
                }
                className="h-full w-full object-cover"
              />
            </span>
          )
        )}
      </Marquee>
    </section>
  );
}
