import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { buttonClassName } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/section-header';
import { promoBanner } from '@/features/home/data/promo-banner';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';

/**
 * 04 - The Silk Edit (homepage Phase 2, 2026-09-25: the Claude Design board). A split
 * on Espresso, and **no copy over the photograph at any width** — the design system's
 * imagery rule, which the old full-bleed banner broke on phones with a floor scrim.
 *
 * - From 1024: the copy column takes two fifths at the inline start, the photograph
 *   the rest to the viewport edge at full height, cropped on the model
 *   (`object-[80%_center]`). A small 4:5 fabric detail straddles the seam low down,
 *   an Espresso keyline around it, so the two images read as one spread. The copy's
 *   inline-start padding tracks the page container, so the eyebrow lines up with
 *   every section above and below it.
 * - Below 1024: the photograph first (4:5 on phones, 3:2 on tablets), then the copy
 *   on Espresso under it. The detail and the caption are desktop-only.
 *
 * In Arabic the split mirrors — copy at the right, photograph at the left — which is
 * layout, not the photograph: the image itself is never flipped. The one call to
 * action is an Ivory button (the primary action inverts on a dark surface).
 *
 * Motion is one step calmer than the campaign (quiet editorial): the photograph opens
 * with the image wipe, the detail follows 200ms later, the title rises word by word,
 * the rest fades. No parallax here, by design.
 */
export async function PromoBanner() {
  const t = await getTranslations('home.banner');

  return (
    <Reveal
      as="section"
      amount={0.2}
      aria-labelledby="promo-banner-title"
      data-surface="ink"
      className="relative isolate overflow-hidden bg-bg text-text lg:grid lg:h-[60vw] lg:max-h-[56rem] lg:min-h-[44rem] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <div
        data-motion="image"
        className="relative isolate aspect-4/5 w-full overflow-hidden bg-bg md:aspect-3/2 lg:order-2 lg:aspect-auto lg:h-full"
      >
        <div
          data-motion-zoom=""
          className="absolute inset-0 [--motion-duration:1400ms] [--motion-zoom:1.04]"
        >
          <Image
            src={editorialImages[promoBanner.wide].src}
            alt={t('imageAlt')}
            fill
            sizes="(min-width: 1024px) 60vw, (min-width: 768px) 100vw, 180vw"
            placeholder="blur"
            className={cn(
              'object-cover',
              promoBanner.portraitImageClassName,
              promoBanner.wideImageClassName
            )}
          />
        </div>
      </div>

      <div className="relative flex flex-col justify-center px-(--page-gutter) pb-14 pt-10 md:pb-20 md:pt-14 lg:order-1 lg:py-24 lg:ps-[max(var(--page-gutter),calc((100vw-var(--container-max))/2+var(--page-gutter)))] lg:pe-12">
        <div data-motion="fade" className="[--motion-offset:120ms]">
          <Eyebrow>{t('eyebrow')}</Eyebrow>
        </div>
        <TextReveal
          as="h2"
          id="promo-banner-title"
          text={t('title')}
          offset={260}
          step={80}
          duration={850}
          className="type-display mt-6 text-text lg:mt-7"
        />
        <p
          data-motion="fade"
          className="type-body-lg measure mt-6 max-w-[26rem] text-text-secondary [--motion-offset:520ms]"
        >
          {t('body')}
        </p>
        <div data-motion="fade" className="mt-8 [--motion-offset:640ms]">
          <Link href={promoBanner.href} className={buttonClassName({ variant: 'primary' })}>
            {t('cta')}
          </Link>
        </div>
        <p
          data-motion="fade"
          className="type-caption mt-14 hidden text-text-secondary [--motion-offset:760ms] lg:block"
        >
          {t('details')}
        </p>
      </div>

      {/* The fabric detail, straddling the seam from 1024. */}
      <div
        data-motion="fade"
        className="absolute bottom-[12%] start-[calc(40%-7.25rem)] z-10 hidden w-58 bg-bg p-3 [--motion-offset:200ms] lg:block xl:w-62"
      >
        <div
          data-motion="image"
          className="relative isolate aspect-4/5 overflow-hidden bg-bg [--motion-offset:200ms]"
        >
          <Image
            src={editorialImages[promoBanner.detail].src}
            alt={t('detailAlt')}
            fill
            sizes="224px"
            placeholder="blur"
            className="object-cover"
          />
        </div>
      </div>
    </Reveal>
  );
}
