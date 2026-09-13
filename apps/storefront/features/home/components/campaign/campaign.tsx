import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 07 — Campaign (guideline §12·07): the visual pause between commerce sections.
 * One full-bleed image, 21:9 from 768 and 4:5 below (a single asset cropped by
 * `object-position`), inside a parallax frame, with one line of ivory display
 * copy — the section's heading — over a local scrim. The cream band before and
 * after is the page's second ivory→cream transition. No box, no card, no link.
 */
export async function Campaign() {
  const t = await getTranslations('home.campaign');

  return (
    <section
      aria-labelledby="campaign-title"
      data-surface="ink"
      className="bg-surface-soft py-4 md:py-8"
    >
      <Container bleed className="relative">
        <Parallax className="relative aspect-4/5 md:aspect-[21/9]">
          <Image
            src={editorialImages.campaign.src}
            alt={t('imageAlt')}
            fill
            sizes="100vw"
            placeholder="blur"
            className="object-cover object-center"
          />
        </Parallax>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 h-[40%] -translate-y-1/2 bg-linear-to-b from-transparent via-scrim to-transparent"
          />
          <Reveal
            as="h2"
            id="campaign-title"
            effect="mask"
            className="type-display relative px-(--page-gutter) text-center text-text"
          >
            {t('line')}
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
