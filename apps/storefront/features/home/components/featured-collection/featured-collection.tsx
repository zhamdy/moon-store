import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 05 - Featured collection: the experimental layout.
 *
 * From 1024: a large 3:2 image in columns 1-8; the title block top-right in 9-12;
 * a small 4:5 image that starts in that column, is pulled a quarter of its width
 * back over the large image and runs past its bottom edge.
 *
 * Below 1024 it is recomposed, not stacked: the large image full width, then the
 * title at the inline start beside the small image, which is pulled up to overlap
 * the large image's bottom edge at the inline end, then the link.
 *
 * Choreography, one Reveal: the large image opens first, the title follows, the
 * small image rises into its overlap later, and the link arrives last. On scroll
 * the small image travels faster than the page (element parallax), so the overlap
 * deepens as the section passes.
 */
export async function FeaturedCollection() {
  const t = await getTranslations('home.featured');

  return (
    <Container as="section" aria-labelledby="featured-title" className="section-y">
      <Reveal className="grid-editorial" amount={0.2}>
        <div
          data-motion="image"
          className="relative col-span-4 aspect-3/2 overflow-hidden bg-surface-soft lg:col-span-8"
        >
          <div data-motion-zoom="" className="absolute inset-0">
            <Image
              src={editorialImages['featured-large'].src}
              alt={t('largeAlt')}
              fill
              sizes="(min-width: 1440px) 900px, (min-width: 1024px) 64vw, 100vw"
              placeholder="blur"
              className="object-cover"
            />
          </div>
        </div>

        <div className="relative col-span-4 grid grid-cols-12 items-start gap-x-4 md:gap-x-6 lg:col-span-4 lg:col-start-9 lg:block">
          <div className="col-span-7 pt-6 md:pt-10 lg:pt-4">
            <p
              data-motion="wipe"
              className="type-label w-fit text-text-secondary [--motion-offset:300ms]"
            >
              {t('eyebrow')}
            </p>
            {/* h2 size below 1024 so the title sits comfortably beside the image;
                a responsive pair, so the lg: variant wins deterministically. */}
            <TextReveal
              as="h2"
              id="featured-title"
              text={t('title')}
              offset={400}
              step={90}
              className="type-h2 lg:type-h1 mt-3 text-balance"
            />
            <p
              data-motion="rise"
              className="type-body mt-4 max-w-xs text-text-secondary [--motion-offset:700ms] [--motion-rise:24px] lg:mt-5"
            >
              {t('body')}
            </p>
          </div>

          <Parallax
            mode="element"
            travel={0.08}
            className="relative col-span-5 -mt-16 md:-mt-28 lg:mt-10 lg:-ms-[25%] lg:w-[110%]"
          >
            <div
              data-motion="rise"
              className="relative aspect-4/5 [--motion-duration:1100ms] [--motion-offset:750ms] [--motion-rise:80px]"
            >
              <div
                data-motion="image"
                className="absolute inset-0 overflow-hidden bg-surface-soft [--motion-offset:750ms]"
              >
                <div data-motion-zoom="" className="absolute inset-0 [--motion-offset:750ms]">
                  <Image
                    src={editorialImages['featured-small'].src}
                    alt={t('smallAlt')}
                    fill
                    sizes="(min-width: 1440px) 440px, (min-width: 1024px) 34vw, 40vw"
                    placeholder="blur"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </Parallax>

          <div
            data-motion="rise"
            className="col-span-12 mt-8 [--motion-offset:1100ms] [--motion-rise:16px] lg:mt-8"
          >
            <EditorialLink href="/collections">{t('link')}</EditorialLink>
          </div>
        </div>
      </Reveal>
    </Container>
  );
}
