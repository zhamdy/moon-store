import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import { editorialStripItems } from '../../data/editorial-strip';
import { Marquee } from './marquee';

const STRIP_IMAGE_HEIGHT = 180;
const STRIP_IMAGE_WIDTH = Math.round((STRIP_IMAGE_HEIGHT * 3) / 4);

/** Each image sits a little above or below the words' centre line, so the layer reads as depth. */
const IMAGE_OFFSETS = [
  '-translate-y-[16%]',
  'translate-y-[18%]',
  '-translate-y-[6%]',
  'translate-y-[10%]',
];

/**
 * 02 - Moving editorial strip. Collection words in display type crossing the
 * cream band that carries the page from the dark hero into the ivory sections,
 * with small portrait details passing over them.
 *
 * Two marquees, not one: the words travel slowly and the images, layered on top,
 * travel about twice as fast in the same direction, so the band has depth rather
 * than sliding as one flat ribbon. Same direction on purpose: opposite directions
 * read as two unrelated tickers, not as near and far.
 *
 * The images are decorative (the words name the collections), so their whole
 * marquee is hidden from assistive tech and ignores the pointer. Hovering the
 * band pauses both. Under reduced motion both stop and the images drop below the
 * words as a second still row.
 */
export async function EditorialStrip() {
  const t = await getTranslations('home.strip');
  const words = editorialStripItems.flatMap((item) => (item.kind === 'word' ? [item] : []));
  const images = editorialStripItems.flatMap((item) => (item.kind === 'image' ? [item] : []));

  return (
    <section
      aria-labelledby="strip-heading"
      data-marquee-group=""
      className="relative overflow-hidden bg-surface-soft py-16 lg:py-24"
    >
      <h2 id="strip-heading" className="sr-only">
        {t('heading')}
      </h2>
      <Marquee duration={30} gap="clamp(2.5rem, 6vw, 5rem)">
        {words.map((item) => (
          <span key={item.messageKey} className="type-display whitespace-nowrap text-text">
            {t(`words.${item.messageKey}`)}
          </span>
        ))}
      </Marquee>
      {/* Vertical padding gives the offset images room inside the marquee's clip. */}
      <Marquee
        decorative
        duration={26}
        gap="clamp(10rem, 24vw, 22rem)"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 py-12',
          'motion-reduce:static motion-reduce:mt-8 motion-reduce:translate-y-0 motion-reduce:py-0'
        )}
      >
        {images.map((item, index) => (
          <Image
            key={item.slot}
            src={editorialImages[item.slot].src}
            alt=""
            width={STRIP_IMAGE_WIDTH}
            height={STRIP_IMAGE_HEIGHT}
            sizes={`${STRIP_IMAGE_WIDTH}px`}
            placeholder="blur"
            className={cn(
              'h-[120px] w-[90px] shrink-0 object-cover md:h-[180px] md:w-[135px]',
              IMAGE_OFFSETS[index % IMAGE_OFFSETS.length],
              'motion-reduce:translate-y-0'
            )}
          />
        ))}
      </Marquee>
    </section>
  );
}
