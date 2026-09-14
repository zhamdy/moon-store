import { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import { HEADER_BOUNDARY_ATTR } from '@/components/layout/header/header-boundary';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import { heroSlides, type HeroSlide } from '../../data/hero-slides';
import { HeroCarousel } from './hero-carousel';

/**
 * Which crop a viewport gets. By shape, not width: a 1024×768 laptop or a portrait
 * tablet is too narrow for the wide crop's empty sides, so it gets the portrait
 * crop, whose empty floor sits under the copy instead.
 */
const WIDE_CROP_MEDIA = '(min-aspect-ratio: 3/2)';

/**
 * 01 — Hero (guideline §12·01): full-viewport slides, one per collection, over
 * which the gold logo and ivory nav float. The root carries `HEADER_BOUNDARY_ATTR`,
 * which is what makes the header transparent (see header-shell.tsx), and pulls
 * itself up under the header's flow slot by `--header-h`.
 *
 * Everything visual renders here on the server and is handed to `HeroCarousel`
 * (client) as slide content; the carousel only decides which slide is active.
 * With no JS the first slide simply shows.
 *
 * The page has one `h1`, screen-reader only, naming the whole hero; each slide's
 * title is an `h2`, and inactive slides are `inert`, so only the visible one is
 * in the accessibility tree.
 */
export async function Hero() {
  const t = await getTranslations('home.hero');
  const total = heroSlides.length;

  const slides = heroSlides.map((slide, index) => ({
    key: slide.key,
    tabLabel: t(`slides.${slide.key}.tab`),
    slideLabel: t('slideOf', { index: index + 1, total }),
    content: (
      <HeroSlidePanel
        slide={slide}
        lead={index === 0}
        eyebrow={t(`slides.${slide.key}.eyebrow`)}
        title1={t(`slides.${slide.key}.title1`)}
        title2={t(`slides.${slide.key}.title2`)}
        body={t(`slides.${slide.key}.body`)}
        cta={t(`slides.${slide.key}.cta`)}
        imageAlt={t(`slides.${slide.key}.imageAlt`)}
      />
    ),
  }));

  return (
    <section
      {...{ [HEADER_BOUNDARY_ATTR]: '' }}
      data-surface="ink"
      aria-labelledby="hero-heading"
      aria-roledescription="carousel"
      className="relative -mt-(--header-h) h-svh min-h-[36rem] overflow-hidden bg-bg text-text"
    >
      <h1 id="hero-heading" className="sr-only">
        {t('heading')}
      </h1>
      <HeroCarousel slides={slides} tabListLabel={t('tabList')} />
    </section>
  );
}

interface HeroSlidePanelProps {
  slide: HeroSlide;
  /** The first slide: the page's LCP image, the only eager one. */
  lead: boolean;
  eyebrow: string;
  title1: string;
  title2: string;
  body: string;
  cta: string;
  imageAlt: string;
}

/**
 * One slide. Art-directed through `getImageProps()` × 2 into one `<picture>`: the
 * wide 16:10 crop when the viewport is at least 3:2, the 4:5 crop otherwise, so a
 * browser downloads only the crop it shows. Only the lead slide is `eager` +
 * `fetchPriority="high"`; the rest are lazy and low priority. No blur: it is
 * incompatible with `<picture>`. Contrast is code-guaranteed by two soft ink
 * scrims (docs/design/editorial-image-brief.md, "Contrast zones").
 *
 * The copy column is deliberately narrow (26rem): every hero photograph keeps its
 * figure in the middle of the frame, and a narrow column at the inline start clears
 * it in both reading directions without mirroring the photograph. 26rem rather than
 * `max-w-md` because at 1280px the wider column reached the Abaya slide's cape.
 *
 * Entrances are CSS keyed on the slide's `data-active` (`data-hero-image`,
 * `data-enter`), so they play on first paint from the server HTML and replay
 * whenever a slide becomes active.
 */
function HeroSlidePanel({
  slide,
  lead,
  eyebrow,
  title1,
  title2,
  body,
  cta,
  imageAlt,
}: HeroSlidePanelProps) {
  const common = {
    alt: imageAlt,
    sizes: '100vw',
    loading: lead ? 'eager' : 'lazy',
    fetchPriority: lead ? 'high' : 'low',
  } as const;
  const { props: wide } = getImageProps({ ...common, src: editorialImages[slide.wide].src });
  const {
    props: { alt, ...portrait },
  } = getImageProps({ ...common, src: editorialImages[slide.portrait].src });

  return (
    <>
      <picture className="absolute inset-0 block">
        <source media={WIDE_CROP_MEDIA} srcSet={wide.srcSet} sizes={wide.sizes} />
        {/* A raw <img> as the direct child of <picture> is the documented art-direction
            form of getImageProps(); @next/next/no-img-element exempts exactly this nesting. */}
        <img
          {...portrait}
          alt={alt}
          data-hero-image=""
          className={cn('h-full w-full object-cover', slide.imageClassName)}
        />
      </picture>

      {/* Header band scrim, ≤ 35% at the top edge and gone by ~30% of the height. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[30%] bg-linear-to-b from-scrim/85 to-transparent"
      />
      {/* Copy and tab-row scrim along the bottom. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-linear-to-t from-scrim to-transparent"
      />

      <div className="absolute inset-0 flex flex-col justify-end">
        {/* Bottom padding clears the tab row. */}
        <Container as="div" className="w-full pt-(--header-h) pb-32 md:pb-36 lg:pb-40">
          <div className="max-w-[26rem]">
            <p
              data-enter="wipe"
              className="type-label w-fit text-text-secondary [--entrance-delay:200ms]"
            >
              {eyebrow}
            </p>
            {/* Two authored lines, each in its own overflow mask so a wrapped line at
                320px is never clipped by its neighbour. type-h1 below md, type-display
                at md+: a responsive pair, where Tailwind emits the md: variant after
                the base utility, so the winner is deterministic. */}
            <h2 className="type-h1 md:type-display mt-4 text-balance">
              <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
                <span data-enter="line" className="block [--entrance-delay:300ms]">
                  {title1}
                </span>
              </span>
              <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
                <span data-enter="line" className="block [--entrance-delay:420ms]">
                  {title2}
                </span>
              </span>
            </h2>
            <p
              data-enter="fade"
              className="type-body-lg mt-5 text-text/85 [--entrance-delay:450ms]"
            >
              {body}
            </p>
            <EditorialLink
              href={slide.href}
              data-enter="fade"
              className="mt-7 [--entrance-delay:600ms]"
            >
              {cta}
            </EditorialLink>
          </div>
        </Container>
      </div>
    </>
  );
}
