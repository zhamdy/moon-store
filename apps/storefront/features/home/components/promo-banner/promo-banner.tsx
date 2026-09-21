import { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { Container } from '@/components/ui/container';
import { promoBanner } from '@/features/home/data/promo-banner';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 04 - Promo banner (user decision, 2026-09-14), in place of the guideline's
 * editorial brand moment. A full-bleed photograph announcing a new collection or
 * an offer: the photograph is the whole section, and the copy sits centred in it.
 *
 * Everything it says lives in `home.banner` in both message catalogues, and the
 * href, slots and per-crop `object-position` live in
 * `features/home/data/promo-banner.ts`, so repurposing it is a data + copy change,
 * never a component change. Offer terms (amounts, dates, conditions) must come
 * from the business; never invent them here.
 *
 * Redesign (user decisions, 2026-09-21). Three things went, in order:
 *
 * - The copy panel. It was a `bg-surface-alt/95` card floated over the photograph —
 *   a second surface painted on top of the image, which is the one thing a campaign
 *   block must not have.
 * - The corner placement and the diagonal gradient that came with the first attempt
 *   at replacing the card. A diagonal over a photograph reads as a wedge painted
 *   onto it, which was the panel's mistake in another form.
 * - The `eyebrow` message ("New collection"). It is no longer rendered anywhere in
 *   this section; the key stays in both catalogues for whoever repurposes the
 *   banner next.
 *
 * What stands now is a centred masthead: the gold rule, the collection name, one
 * line of copy and the button, on the axis of the frame at every width and in both
 * languages. Nothing here mirrors, so the physical-left rule the wide layout used to
 * carry (user feedback, 2026-09-14, for a figure standing in the right third) no
 * longer applies. The centring also fixed the message hierarchy the card had
 * inverted: `title` ("The Silk Edit") is the display H2 the section is named by,
 * where the season label used to carry H1 weight and the collection name sat under
 * it at `type-h4`.
 *
 * Art-directed like the hero, and chosen by shape like the hero: the 16:9
 * `moment-wide` crop on landscape screens at least 768px wide and 4:3
 * (`banner-wide`, app/globals.css), the 4:5 `moment` on phones and portrait
 * tablets. Through `getImageProps()` into one `<picture>` (lazy; no blur, which
 * `<picture>` cannot take).
 *
 * Contrast follows the copy: centred type sits over the figure, not beside her, so
 * the local gradients a side-anchored block could use are no longer available and
 * the scrim covers the frame. It is kept deliberately light — an even `/40` veil,
 * then a vertical gradient deepening toward the floor and thinning to `/10` at the
 * top, rather than one flat dark layer. Composited against a bright warm crop
 * (#c9b49c) the copy band lands near 0.67: ivory about 7.4:1, past the 4.5:1 body
 * threshold with room for a brighter photograph. **Gold is never text here** — over
 * the same ground it lands near 4:1 — so it draws the one short rule and nothing
 * else (docs/design/editorial-image-brief.md).
 *
 * The CTA is the house button shape (min-h-12, rounded-sm, px-7) drawn as a `Link`,
 * since `Button` renders a native `<button>` and this navigates. An ivory hairline
 * filling ivory on hover, not a solid bronze block: a filled block over a
 * photograph reads as an ad unit.
 *
 * Layers are explicit (photo z-0, scrims z-10, copy z-20). Motion, one Reveal: the
 * photograph settles from 1.08 as the section arrives and drifts with the scroll;
 * the rule fades in, the title rises word by word, and the description and the
 * button follow. Scrims never move, so contrast holds at every frame.
 */
export async function PromoBanner() {
  const t = await getTranslations('home.banner');

  const common = { alt: t('imageAlt'), sizes: '100vw' } as const;
  const { props: desktop } = getImageProps({
    ...common,
    src: editorialImages[promoBanner.wide].src,
  });
  const {
    props: { alt, ...mobile },
  } = getImageProps({ ...common, src: editorialImages[promoBanner.portrait].src });

  return (
    <Reveal
      as="section"
      amount={0.3}
      aria-labelledby="promo-banner-title"
      data-surface="ink"
      className="relative isolate flex h-[86svh] min-h-[32rem] items-center overflow-hidden bg-dark-surface text-text banner-wide:h-[80svh]"
    >
      <Parallax travel={0.07} className="absolute inset-0 z-0">
        <div
          data-motion-zoom=""
          className="absolute inset-0 [--motion-duration:1800ms] [--motion-zoom:1.08]"
        >
          <picture className="absolute inset-0 block">
            <source
              media="(min-width: 768px) and (min-aspect-ratio: 4/3)"
              srcSet={desktop.srcSet}
              sizes={desktop.sizes}
            />
            {/* A raw <img> as the direct child of <picture> is the documented art-direction
                form of getImageProps(); @next/next/no-img-element exempts exactly this nesting. */}
            <img
              {...mobile}
              alt={alt}
              className={`absolute inset-0 h-full w-full object-cover ${promoBanner.portraitImageClassName} ${promoBanner.wideImageClassName}`}
            />
          </picture>
        </div>
      </Parallax>

      {/* One scrim for the whole frame, because the copy is centred over the figure
          rather than beside her: a light even veil, then a vertical gradient that
          deepens toward the floor the button stands on and thins to almost nothing at
          the top, so the photograph still reads as the section's mood. Composited
          against a bright warm crop the copy band lands near 0.67 — ivory about
          7.4:1, well past the body threshold. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-dark-surface/40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-linear-to-t from-dark-surface/60 from-0% via-dark-surface/45 via-50% to-dark-surface/10 to-100%"
      />

      <Container as="div" className="relative z-20 w-full">
        {/* Centred at every width and in both languages (user decision, 2026-09-21), so
            nothing here mirrors and the old physical-left rule no longer applies. */}
        <div className="mx-auto max-w-[36rem] text-center">
          {/* The section's one gold detail: a short rule opening the block. */}
          <div
            aria-hidden="true"
            data-motion="fade"
            className="mx-auto h-px w-12 bg-metallic/90 [--motion-offset:160ms]"
          />

          <TextReveal
            as="h2"
            id="promo-banner-title"
            text={t('title')}
            offset={320}
            step={90}
            duration={1000}
            className="mt-7 type-h1 banner-wide:type-display text-balance text-text"
          />

          <p
            data-motion="rise"
            className="type-body-lg mx-auto mt-5 max-w-[38ch] text-balance text-text-secondary [--motion-offset:720ms] [--motion-rise:28px]"
          >
            {t('body')}
          </p>

          <div data-motion="rise" className="mt-9 [--motion-offset:880ms] [--motion-rise:20px]">
            {/* The house button shape (min-h-12, rounded-sm, px-7) drawn as a link, since
                `Button` renders a native <button> and this navigates. An ivory hairline
                that fills ivory on hover: a solid bronze block over a photograph reads as
                an ad unit, and the hairline is the Button's own `secondary` language on
                an ink surface. */}
            <Link
              href={promoBanner.href}
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-text/70 px-8 type-label text-text transition-colors duration-fast ease-ui hover:border-text hover:bg-text hover:text-dark-surface focus-visible:border-text focus-visible:bg-text focus-visible:text-dark-surface"
            >
              {t('cta')}
              <ArrowRight
                aria-hidden="true"
                size={16}
                className="transition-transform duration-fast ease-ui group-hover:translate-x-1 group-focus-visible:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 rtl:group-focus-visible:-translate-x-1"
              />
            </Link>
          </div>
        </div>
      </Container>
    </Reveal>
  );
}
