import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 07 — Campaign (guideline §12·07): the visual pause between commerce sections.
 * One full-bleed image, 21:9 from 768 and 4:5 below (a single asset: the mobile
 * crop is centred on the figure through `object-position`), inside a parallax
 * frame, with one line of ivory display copy that is the section's heading.
 *
 * The statement sits in the photograph's empty space, never across the model: the
 * figure stands in the right third, so from 768 the line is set on the **physical
 * left in both languages** (the photograph is never mirrored) and on mobile it sits
 * at the bottom over empty paving. Each position gets only a soft local scrim on
 * its own side; there is no overlay across the photograph, which stays image-led.
 * The cream band before and after is the page's second ivory→cream transition.
 */
export async function Campaign() {
  const t = await getTranslations('home.campaign');

  return (
    <section
      aria-labelledby="campaign-title"
      data-surface="ink"
      className="bg-surface-soft py-4 md:py-8"
    >
      <div className="relative isolate">
        <Parallax travel={0.05} className="relative z-0 aspect-4/5 md:aspect-[21/9]">
          <Image
            src={editorialImages.campaign.src}
            alt={t('imageAlt')}
            fill
            sizes="100vw"
            placeholder="blur"
            className="object-cover object-[72%_50%] md:object-center"
          />
        </Parallax>

        {/* Mobile: soft scrim under the bottom line only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-linear-to-t from-scrim to-transparent md:hidden"
        />
        {/* 768+: soft scrim on the empty left side only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-3/5 bg-linear-to-r from-scrim to-transparent md:block"
        />

        <div className="pointer-events-none absolute inset-0 z-20 flex items-end md:items-center">
          <Container as="div" className="w-full pb-10 md:pb-0">
            {/* Under RTL, margin-inline-start: auto keeps the line on the physical left. */}
            <Reveal
              as="h2"
              id="campaign-title"
              effect="mask"
              className="type-h1 md:type-display max-w-[11ch] text-balance text-text rtl:md:ms-auto"
            >
              {t('line')}
            </Reveal>
          </Container>
        </div>
      </div>
    </section>
  );
}
