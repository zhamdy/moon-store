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
 * an offer: a label, a headline, one line and a button.
 *
 * Everything it says lives in `home.banner` in both message catalogues, and the
 * href, slots and per-crop `object-position` live in
 * `features/home/data/promo-banner.ts`, so repurposing it is a data + copy change,
 * never a component change. Offer terms (amounts, dates, conditions) must come
 * from the business; never invent them here.
 *
 * Art-directed like the hero: a 16:9 `moment-wide` crop from 768 and the 4:5
 * `moment` below, through `getImageProps()` into one `<picture>` (lazy; no blur,
 * which `<picture>` cannot take). Contrast is code-guaranteed by a strong ink scrim
 * on the copy side: fading from the left edge from 768, rising from the bottom on
 * mobile (docs/design/editorial-image-brief.md).
 *
 * From 768 the copy stays on the **physical left in both languages** (user
 * feedback, 2026-09-14): the photograph is never mirrored and its figure stands on
 * the right, so following the reading direction put the Arabic copy across her
 * face. Arabic text keeps its natural right alignment inside the left-hand block.
 *
 * Layers are explicit (photo z-0, scrims z-10, copy z-20). Motion, one Reveal: the
 * photograph settles from 1.08 as the section arrives and drifts with the scroll;
 * the label wipes in, the headline rises word by word, the line follows and the
 * button comes last. Scrims never move, so contrast holds at every frame.
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
      className="relative isolate flex h-[90svh] min-h-[34rem] items-end overflow-hidden bg-bg text-text md:h-[80svh] md:items-center"
    >
      <Parallax travel={0.07} className="absolute inset-0 z-0">
        <div
          data-motion-zoom=""
          className="absolute inset-0 [--motion-duration:1800ms] [--motion-zoom:1.08]"
        >
          <picture className="absolute inset-0 block">
            <source media="(min-width: 768px)" srcSet={desktop.srcSet} sizes={desktop.sizes} />
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

      {/* Mobile: copy at the bottom, scrim rising from it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-linear-to-t from-scrim-strong to-transparent to-60% md:hidden"
      />
      {/* 768+: copy on the physical left in both languages, scrim fading from there.
          Deliberately not mirrored under RTL: the figure is on the right. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 hidden bg-linear-to-r from-scrim-strong from-0% via-scrim via-40% to-transparent to-75% md:block"
      />

      <Container as="div" className="relative z-20 w-full py-(--section-space)">
        {/* Under RTL, margin-inline-start: auto pushes the block to the physical left. */}
        <div className="max-w-xl rtl:md:ms-auto">
          <p
            data-motion="wipe"
            className="type-label w-fit text-text-secondary [--motion-offset:250ms]"
          >
            {t('eyebrow')}
          </p>
          <TextReveal
            as="h2"
            id="promo-banner-title"
            text={t('title')}
            offset={350}
            step={80}
            className="type-h1 mt-4 text-balance"
          />
          <p
            data-motion="rise"
            className="type-body-lg mt-5 max-w-md text-text/85 [--motion-offset:700ms] [--motion-rise:32px]"
          >
            {t('body')}
          </p>
          {/* The button's own colour transition would replace the reveal's, so the
              wrapper carries the entrance. */}
          <div data-motion="rise" className="mt-8 [--motion-offset:900ms] [--motion-rise:24px]">
            {/* Ivory on the ink surface: bg-text / text-bg invert with the surface. */}
            <Link
              href={promoBanner.href}
              className="group inline-flex min-h-12 items-center gap-3 bg-text px-7 text-bg transition-colors duration-fast ease-ui hover:bg-text/85"
            >
              <span className="type-label">{t('cta')}</span>
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
