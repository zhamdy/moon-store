import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 05 — Featured collection (guideline §12·05): the experimental layout. A large
 * 3:2 image in columns 1–8; the title block top-right in 9–12; a small 4:5 image
 * that starts in that column, is pulled a quarter of its width back over the
 * large image and runs past its bottom edge — the overlap the guideline asks for.
 * Below 1024 it is recomposed, not stacked: the large image, then title and the
 * small image side by side in a 3:2 split, then the link.
 */
export async function FeaturedCollection() {
  const t = await getTranslations('home.featured');

  return (
    <Container as="section" aria-labelledby="featured-title" className="section-y">
      <div className="grid-editorial">
        <Reveal className="relative col-span-4 aspect-3/2 bg-surface-soft lg:col-span-8">
          <Image
            src={editorialImages['featured-large'].src}
            alt={t('largeAlt')}
            fill
            sizes="(min-width: 1440px) 900px, (min-width: 1024px) 64vw, 100vw"
            placeholder="blur"
            className="object-cover"
          />
        </Reveal>

        <div className="col-span-4 grid grid-cols-5 gap-x-4 gap-y-6 lg:col-span-4 lg:col-start-9 lg:block">
          <Reveal className="col-span-3 lg:pt-4">
            <p className="type-label text-text-secondary">{t('eyebrow')}</p>
            <h2 id="featured-title" className="type-h1 mt-3">
              {t('title')}
            </h2>
            <p className="type-body mt-5 max-w-xs text-text-secondary">{t('body')}</p>
          </Reveal>

          <Reveal
            delay={1}
            className="relative col-span-2 aspect-4/5 bg-surface-soft lg:mt-10 lg:-ms-[25%] lg:w-[110%]"
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

          <Reveal delay={2} className="col-span-5 lg:mt-8">
            <EditorialLink href="/collections">{t('link')}</EditorialLink>
          </Reveal>
        </div>
      </div>
    </Container>
  );
}
