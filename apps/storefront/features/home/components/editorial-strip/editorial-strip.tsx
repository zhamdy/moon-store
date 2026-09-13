import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { editorialImages } from '@/lib/editorial/images';
import { editorialStripItems } from '../../data/editorial-strip';
import { Marquee } from './marquee';

const STRIP_IMAGE_HEIGHT = 180;
const STRIP_IMAGE_WIDTH = Math.round((STRIP_IMAGE_HEIGHT * 3) / 4);

/**
 * 02 — Moving editorial strip (guideline §12·02). Collection words in display
 * type crossing the screen between small portrait details, on the cream band
 * that carries the page from the dark hero into the ivory sections. The only
 * marquee on the page; the images are decorative (`alt=""`) because the words
 * name the collections.
 */
export async function EditorialStrip() {
  const t = await getTranslations('home.strip');

  return (
    <section aria-labelledby="strip-heading" className="bg-surface-soft py-10 lg:py-14">
      <h2 id="strip-heading" className="sr-only">
        {t('heading')}
      </h2>
      <Marquee>
        {editorialStripItems.map((item, index) =>
          item.kind === 'word' ? (
            <span key={index} className="type-display whitespace-nowrap text-text">
              {t(`words.${item.messageKey}`)}
            </span>
          ) : (
            <Image
              key={index}
              src={editorialImages[item.slot].src}
              alt=""
              width={STRIP_IMAGE_WIDTH}
              height={STRIP_IMAGE_HEIGHT}
              sizes={`${STRIP_IMAGE_WIDTH}px`}
              placeholder="blur"
              className="shrink-0 object-cover"
            />
          )
        )}
      </Marquee>
    </section>
  );
}
