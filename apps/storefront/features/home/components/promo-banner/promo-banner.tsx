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
 * On portrait screens the photograph gets its own frame above the copy, preserving
 * the blouse and face without placing text over either. Physical placement stays
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
    // A 16:9 source covering a 4:5 frame needs 2.22x the frame's pixel width.
    sizes: '223vw',
  });

  return (
    <Reveal
      as="section"
      amount={0.2}
      aria-labelledby="promo-banner-title"
      data-surface="ink"
      className="relative isolate overflow-hidden bg-dark-surface text-text banner-wide:grid banner-wide:min-h-[34rem] banner-wide:max-h-[50rem] banner-wide:aspect-video banner-wide:items-center"
    >
      <div className="relative aspect-4/5 overflow-hidden banner-wide:absolute banner-wide:inset-0 banner-wide:aspect-auto">
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

      {/* Shade only the desktop copy area, keeping the ivory silk luminous. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-dark-surface/80 via-dark-surface/35 via-45% to-transparent to-72% banner-wide:block"
      />

      <Container as="div" className="relative z-10 w-full py-12 md:py-16 banner-wide:py-12">
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
