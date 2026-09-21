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
 * that is the section's heading. It is the only section on the page with no link
 * in it, deliberately — the two commerce sections it sits between each end in a
 * call to action, and a third would make the pause another offer.
 *
 * Redesign (2026-09-21), three changes:
 *
 * - The espresso band. The section used to carry `py-4 md:py-8`, which put a thin
 *   dark margin between the cream sections and the photograph. At that size it read
 *   as a letterbox seam rather than as a mat, so the photograph now meets the cream
 *   directly, as the hero does.
 * - The line is anchored to the floor of the frame at every width. It used to be
 *   vertically centred from 768, which read as a quote on a slide; low in the frame
 *   it reads as a campaign still, and the colonnade above it gets to be architecture.
 * - The rule moved above the line and went gold, from champagne below it. The Silk
 *   Edit and the Evening Edit both open their block with that rule; this is the
 *   third, so the page's signature moments rhyme.
 *
 * The frame is capped at `40rem` from 768. Unbounded 21:9 is 1100px tall at 2560,
 * which is a section nobody can see at once.
 *
 * The statement sits in the photograph's empty space, never across the model: the
 * figure stands in the right third, so the line is set on the **physical left in
 * both languages at every width** (the photograph is never mirrored). On phones the
 * 4:5 window leaves the figure in the right half, so following the reading direction
 * put the Arabic line across her (freeze capture, 2026-09-14), and the line is capped
 * at 10rem there (not a ch width: in Lora 9ch still held "Dressed for" on one line)
 * so both languages clear her arm at 320. Each position gets only a soft local scrim
 * on its own side.
 *
 * Motion is slow on purpose: the photograph settles from 1.06 over two seconds
 * while it drifts with the scroll, the rule draws, and the line rises word by word
 * through its masks with a long step. It plays when the section is well into view,
 * so on a phone the line at the bottom is on screen when it arrives.
 */
export async function Campaign() {
  const t = await getTranslations('home.campaign');

  return (
    <section aria-labelledby="campaign-title" data-surface="dark" className="bg-dark-surface">
      <Reveal className="relative isolate" amount={0.45}>
        <Parallax
          travel={0.06}
          className="relative z-0 aspect-4/5 md:aspect-[21/9] md:max-h-[40rem]"
        >
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

        {/* Mobile: Espresso base tone with subtle nocturnal twilight under bottom copy */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/2 bg-linear-to-t from-dark-surface/90 via-editorial-secondary/25 to-transparent md:hidden"
        />
        {/* 768+: Espresso base tone with subtle nocturnal twilight on empty copy side */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-3/5 bg-linear-to-r from-dark-surface/90 via-editorial-secondary/22 via-45% to-transparent md:block"
        />

        <div className="pointer-events-none absolute inset-0 z-20 flex items-end">
          <Container as="div" className="w-full pb-10 md:pb-16">
            {/* Under RTL, margin-inline-start: auto keeps the line on the physical left, at every width. */}
            <div className="max-w-[10rem] md:max-w-[12ch] rtl:ms-auto">
              <div
                aria-hidden="true"
                data-motion="fade"
                className="h-px w-10 bg-metallic [--motion-offset:200ms]"
              />
              <TextReveal
                as="h2"
                id="campaign-title"
                text={t('line')}
                offset={420}
                step={120}
                duration={1100}
                className="mt-6 type-h1 md:type-display text-balance text-text"
              />
            </div>
          </Container>
        </div>
      </Reveal>
    </section>
  );
}
