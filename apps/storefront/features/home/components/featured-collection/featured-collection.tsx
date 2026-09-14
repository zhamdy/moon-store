import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 05 — Featured collection (guideline §12·05): the experimental layout.
 *
 * From 1024: a large 3:2 image in columns 1–8; the title block top-right in 9–12;
 * a small 4:5 image that starts in that column, is pulled a quarter of its width
 * back over the large image and runs past its bottom edge.
 *
 * Below 1024 it is recomposed, not stacked: the large image full width, then the
 * title at the inline start beside the small image, which is pulled up to overlap
 * the large image's bottom edge at the inline end, then the link. The overlap is
 * the same gesture as on desktop, scaled to the width.
 *
 * Motion is deliberately light: the title block and the small image reveal; the
 * large image and the link do not, so the section never animates four things at once.
 */
export async function FeaturedCollection() {
  const t = await getTranslations('home.featured');

  return (
    <Container as="section" aria-labelledby="featured-title" className="section-y">
      <div className="grid-editorial">
        <div className="relative col-span-4 aspect-3/2 bg-surface-soft lg:col-span-8">
          <Image
            src={editorialImages['featured-large'].src}
            alt={t('largeAlt')}
            fill
            sizes="(min-width: 1440px) 900px, (min-width: 1024px) 64vw, 100vw"
            placeholder="blur"
            className="object-cover"
          />
        </div>

        <div className="relative col-span-4 grid grid-cols-12 items-start gap-x-4 md:gap-x-6 lg:col-span-4 lg:col-start-9 lg:block">
          <Reveal className="col-span-7 pt-6 md:pt-10 lg:pt-4">
            <p className="type-label text-text-secondary">{t('eyebrow')}</p>
            {/* h2 size below 1024 so the title sits comfortably beside the image;
                a responsive pair, so the lg: variant wins deterministically. */}
            <h2 id="featured-title" className="type-h2 lg:type-h1 mt-3 text-balance">
              {t('title')}
            </h2>
            <p className="type-body mt-4 max-w-xs text-text-secondary lg:mt-5">{t('body')}</p>
          </Reveal>

          <Reveal
            delay={1}
            className="relative col-span-5 -mt-16 aspect-4/5 bg-surface-soft md:-mt-28 lg:mt-10 lg:-ms-[25%] lg:w-[110%]"
          >
            <Image
              src={editorialImages['featured-small'].src}
              alt={t('smallAlt')}
              fill
              sizes="(min-width: 1440px) 440px, (min-width: 1024px) 34vw, 40vw"
              placeholder="blur"
              className="object-cover"
            />
          </Reveal>

          <div className="col-span-12 mt-8 lg:mt-8">
            <EditorialLink href="/collections">{t('link')}</EditorialLink>
          </div>
        </div>
      </div>
    </Container>
  );
}
