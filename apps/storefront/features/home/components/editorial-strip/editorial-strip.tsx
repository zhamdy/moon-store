import type { CSSProperties } from 'react';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';
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
 * The pause toggle (WCAG 2.2.2) is a native checkbox with `role="switch"`, no
 * client boundary: `[data-strip]:has([data-strip-toggle]:checked)` in
 * `app/globals.css` pauses `.marquee-track` and `[data-strip-pan]` the same way
 * `:hover`/`:focus-within` already do. It sits below the tracks, outside them, so
 * it is never duplicated or animated by the marquee. Session-only (no storage):
 * the page is static, so a reload restarting motion is acceptable.
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
              className="relative block shrink-0 overflow-hidden"
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
      {/* Outside both .marquee-tracks so it is never duplicated or paused itself;
          hidden under reduced motion (nothing moves) and where :has() is
          unsupported (it would do nothing). Icon shows the action available
          next: pause while moving, play while paused. */}
      <Container className="mt-6 flex justify-end">
        <label
          data-strip-toggle-control=""
          className="group relative flex h-11 w-11 items-center justify-center text-text-secondary transition-opacity duration-fast ease-ui hover:text-text"
        >
          <input
            type="checkbox"
            role="switch"
            data-strip-toggle=""
            aria-label={t('pause')}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <Pause
            aria-hidden="true"
            size={18}
            strokeWidth={1.5}
            className="pointer-events-none group-has-[:checked]:hidden"
          />
          <Play
            aria-hidden="true"
            size={18}
            strokeWidth={1.5}
            className="pointer-events-none hidden group-has-[:checked]:block"
          />
        </label>
      </Container>
    </section>
  );
}
