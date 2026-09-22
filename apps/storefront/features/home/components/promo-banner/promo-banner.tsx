import { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { promoBanner } from '@/features/home/data/promo-banner';
import { editorialImages } from '@/lib/editorial/images';

/**
 * The Silk Edit: copy over the photograph's quiet left side on landscape screens.
 * On portrait screens the image fills the section, with copy over a bottom scrim.
 * An explicit full width prevents the capped desktop aspect ratio from shrinking
 * the section on wide displays. Physical placement stays
 * the same in both languages; only the copy's reading direction changes.
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
  } = getImageProps({
    ...common,
    src: editorialImages[promoBanner.portrait].src,
    // The wide source covers a portrait section at least 40rem tall.
    sizes: 'max(72rem, 160svh)',
  });

  return (
    <Reveal
      as="section"
      amount={0.2}
      aria-labelledby="promo-banner-title"
      data-surface="ink"
      className="relative isolate flex h-[90svh] min-h-[40rem] w-full items-end overflow-hidden bg-dark-surface text-text banner-wide:aspect-video banner-wide:h-auto banner-wide:min-h-[34rem] banner-wide:max-h-[50rem] banner-wide:items-center"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          data-motion-zoom=""
          className="absolute inset-0 [--motion-duration:1600ms] [--motion-zoom:1.025]"
        >
          <picture className="absolute inset-0 block">
            <source
              media="(min-width: 768px) and (min-aspect-ratio: 4/3)"
              srcSet={desktop.srcSet}
              sizes={desktop.sizes}
            />
            <img
              {...mobile}
              alt={alt}
              className={`absolute inset-0 h-full w-full object-cover ${promoBanner.portraitImageClassName} ${promoBanner.wideImageClassName}`}
            />
          </picture>
        </div>
      </div>

      {/* The mobile floor protects text contrast while leaving the face and blouse clear. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-dark-surface/95 via-dark-surface/65 via-30% to-transparent to-75% banner-wide:hidden"
      />
      {/* Shade only the desktop copy area, keeping the ivory silk luminous. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-dark-surface/80 via-dark-surface/35 via-45% to-transparent to-72% banner-wide:block"
      />

      <Container as="div" className="relative z-10 w-full pb-10 pt-24 md:pb-14 banner-wide:py-12">
        <div className="mx-auto max-w-[32rem] text-center banner-wide:mx-0 banner-wide:mr-auto banner-wide:w-[43%] banner-wide:max-w-[30rem]">
          <span
            aria-hidden="true"
            data-motion="fade"
            className="mx-auto block h-px w-12 bg-metallic [--motion-offset:100ms]"
          />
          <TextReveal
            as="h2"
            id="promo-banner-title"
            text={t('title')}
            offset={180}
            step={70}
            duration={850}
            className="type-h1 mt-6 text-balance text-text banner-wide:text-[clamp(3rem,5.2vw,5rem)]"
          />
          <p
            data-motion="rise"
            className="type-body mx-auto mt-5 max-w-[32ch] text-balance text-text-secondary [--motion-offset:380ms] [--motion-rise:16px] md:type-body-lg"
          >
            {t('body')}
          </p>
          <div data-motion="rise" className="mt-8 [--motion-offset:500ms] [--motion-rise:12px]">
            <EditorialLink
              href={promoBanner.href}
              underline="always"
              className="min-h-11 gap-4 pb-2 uppercase tracking-[0.12em] rtl:tracking-normal"
            >
              {t('cta')}
            </EditorialLink>
          </div>
        </div>
      </Container>
    </Reveal>
  );
}
