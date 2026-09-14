import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { Container } from '@/components/ui/container';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 07 - Campaign: the visual pause between commerce sections. One full-bleed
 * image, 21:9 from 768 and 4:5 below (a single asset: the mobile crop is centred
 * on the figure through `object-position`), with one line of ivory display copy
 * that is the section's heading.
 *
 * The statement sits in the photograph's empty space, never across the model: the
 * figure stands in the right third, so the line is set on the **physical left in
 * both languages at every width** (the photograph is never mirrored): vertically
 * centred from 768, bottom-left over the paving on mobile. On phones the 4:5 window
 * leaves the figure in the right half, so following the reading direction put the
 * Arabic line across her (freeze capture, 2026-09-14), and the line is capped at
 * 10rem there (not a ch width: in Lora 9ch still held "Dressed for" on one line)
 * so both languages clear her arm at 320. Each position gets only a soft local scrim on
 * its own side. The cream band before and after is the page's second ivory->cream
 * transition.
 *
 * Motion is slow on purpose: the photograph settles from 1.06 over two seconds
 * while it drifts with the scroll, and the line rises word by word through its
 * masks with a long step. It plays when the section is well into view, so on a
 * phone the line at the bottom is on screen when it arrives.
 */
export async function Campaign() {
  const t = await getTranslations('home.campaign');

  return (
    <section
      aria-labelledby="campaign-title"
      data-surface="ink"
      className="bg-surface-soft py-4 md:py-8"
    >
      <Reveal className="relative isolate" amount={0.45}>
        <Parallax travel={0.06} className="relative z-0 aspect-4/5 md:aspect-[21/9]">
          <div
            data-motion-zoom=""
            className="absolute inset-0 [--motion-duration:2000ms] [--motion-zoom:1.06]"
          >
            <Image
              src={editorialImages.campaign.src}
              alt={t('imageAlt')}
              fill
              sizes="100vw"
              placeholder="blur"
              className="object-cover object-[72%_50%] md:object-center"
            />
          </div>
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
            {/* Under RTL, margin-inline-start: auto keeps the line on the physical left, at every width. */}
            <TextReveal
              as="h2"
              id="campaign-title"
              text={t('line')}
              offset={300}
              step={120}
              duration={1100}
              className="type-h1 md:type-display max-w-[10rem] text-balance text-text md:max-w-[11ch] rtl:ms-auto"
            />
          </Container>
        </div>
      </Reveal>
    </section>
  );
}
