import { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { promoBanner } from '@/features/home/data/promo-banner';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 04 - Promo banner (user decision, 2026-09-14), in place of the guideline's
 * editorial brand moment. A full-bleed photograph announcing a new collection or
 * an offer: the image *is* the section, and the copy stands on its floor.
 *
 * Everything it says lives in `home.banner` in both message catalogues, and the
 * href, slots and per-crop `object-position` live in
 * `features/home/data/promo-banner.ts`, so repurposing it is a data + copy change,
 * never a component change. Offer terms (amounts, dates, conditions) must come
 * from the business; never invent them here.
 *
 * Redesign (user decision, 2026-09-21): the copy panel is gone. It was a
 * `bg-surface-alt/95` card floated over the photograph — a second surface painted
 * on top of the image, which is the one thing a campaign block must not have. What
 * replaces it is the hero's vocabulary: a masthead anchored to the bottom of the
 * frame at every width, over gradients that read as part of the photograph rather
 * than as a panel. The same change corrects the message hierarchy: `title`
 * ("The Silk Edit") is now the display H2 the section is named by, and `eyebrow`
 * ("New collection") the small champagne label above it — the reverse of the
 * 2026-09-14 arrangement, where the season label carried H1 weight and the
 * collection name sat under it at `type-h4`.
 *
 * Art-directed like the hero, and chosen by shape like the hero: the 16:9
 * `moment-wide` crop on landscape screens at least 768px wide and 4:3
 * (`banner-wide`, app/globals.css), the 4:5 `moment` on phones and portrait
 * tablets, where the wide crop would zoom onto the figure and put the copy on her.
 * Through `getImageProps()` into one `<picture>` (lazy; no blur, which `<picture>`
 * cannot take).
 *
 * Contrast is code-guaranteed and deliberately local, so most of the frame stays
 * untouched photograph: one gradient anchored to the corner the copy occupies —
 * rising from the floor in the portrait layout, running out of the bottom-left in
 * the wide one — reaching `dark-surface/92` where the copy sits and clearing to
 * nothing by roughly two thirds of the frame. Measured against a bright warm crop
 * (#c9b49c), ivory reads about 10.8:1 there and champagne about 5.9:1. **Gold is
 * never text here**: over the same ground it lands near 4:1, under the 4.5:1 body
 * threshold, so it draws the one hairline beside the eyebrow and nothing else
 * (docs/design/editorial-image-brief.md).
 *
 * In the wide layout the copy stays on the **physical left in both languages** (user
 * feedback, 2026-09-14): the photograph is never mirrored and its figure stands on
 * the right, so following the reading direction put the Arabic copy across her
 * face. The gradient is physical (`to-tr`) for the same reason. Arabic text keeps
 * its natural right alignment inside the left-hand block.
 *
 * Layers are explicit (photo z-0, scrims z-10, copy z-20). Motion, one Reveal: the
 * photograph settles from 1.08 as the section arrives and drifts with the scroll;
 * the eyebrow and its hairline fade in, the title rises word by word, and the
 * description and the link follow. Scrims never move, so contrast holds at every
 * frame.
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
      className="relative isolate flex h-[90svh] min-h-[34rem] items-end overflow-hidden bg-dark-surface text-text banner-wide:h-[84svh]"
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

      {/* Portrait layout: copy on the floor, the gradient rising from it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-linear-to-t from-dark-surface/92 from-0% via-dark-surface/58 via-44% to-transparent to-80% banner-wide:hidden"
      />
      {/* Wide layout: copy in the bottom-left corner in both languages, the gradient
          running out of that corner. Deliberately not mirrored under RTL: the figure
          is on the right, and the top-right of the frame is left as photograph. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 hidden bg-linear-to-tr from-dark-surface/92 from-0% via-dark-surface/55 via-36% to-transparent to-70% banner-wide:block"
      />

      <Container as="div" className="relative z-20 w-full pb-14 banner-wide:pb-20">
        {/* Under RTL, margin-inline-start: auto pushes the block to the physical left.
            Narrower than half the frame at every width: the photograph keeps the rest. */}
        <div className="max-w-[34rem] rtl:banner-wide:ms-auto">
          {/* The season label, carrying the section's one gold detail. */}
          <p
            data-motion="fade"
            className="flex items-center gap-3 type-caption uppercase tracking-[0.22em] rtl:tracking-normal text-metallic-highlight [--motion-offset:200ms]"
          >
            <span aria-hidden="true" className="h-px w-8 shrink-0 bg-metallic" />
            {t('eyebrow')}
          </p>

          <TextReveal
            as="h2"
            id="promo-banner-title"
            text={t('title')}
            offset={340}
            step={90}
            duration={1000}
            className="mt-4 type-h1 banner-wide:type-display text-balance text-text"
          />

          <p
            data-motion="rise"
            className="type-body-lg mt-5 max-w-[34ch] text-text-secondary [--motion-offset:760ms] [--motion-rise:28px]"
          >
            {t('body')}
          </p>

          <div data-motion="rise" className="mt-8 [--motion-offset:920ms] [--motion-rise:20px]">
            <EditorialLink
              href={promoBanner.href}
              underline="always"
              className="min-h-11 text-text hover:text-metallic-highlight focus-visible:text-metallic-highlight transition-colors duration-fast ease-ui"
            >
              {t('cta')}
            </EditorialLink>
          </div>
        </div>
      </Container>
    </Reveal>
  );
}
