import { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import { HEADER_BOUNDARY_ATTR } from '@/components/layout/header/header-boundary';
import { buttonClassName } from '@/components/ui/button';
import { EditorialLink } from '@/components/ui/editorial-link';
import { Eyebrow } from '@/components/ui/section-header';
import { Link } from '@/i18n/navigation';
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
 * 01 — Hero (guideline §12·01): Direction A Editorial Stage.
 * Full-viewport slides, one per collection. The photograph is the stage itself —
 * full-bleed to all four edges at every breakpoint — and the copy is a campaign
 * masthead standing on the floor of the frame at every width, over one bottom
 * gradient rather than a reserved panel. The root carries `HEADER_BOUNDARY_ATTR`,
 * which makes the header transparent, and pulls itself up under the header's flow
 * slot by `--header-h`.
 *
 * Everything visual renders here on the server and is handed to `HeroCarousel`
 * (client) as slide content; the carousel only decides which slide is active.
 * With no JS the first slide simply shows.
 *
 * The page has one `h1`, screen-reader only, naming the whole hero; each slide's
 * title is an `h2` naming the collection, and inactive slides are `inert`, so
 * only the visible one is in the accessibility tree.
 */
export async function Hero() {
  const t = await getTranslations('home.hero');
  const total = heroSlides.length;

  const slides = heroSlides.map((slide, index) => ({
    key: slide.key,
    tabLabel: t(`slides.${slide.key}.tab`),
    slideLabel: t('slideOf', { index: index + 1, total }),
    media: (
      <HeroSlideMedia
        slide={slide}
        lead={index === 0}
        imageAlt={t(`slides.${slide.key}.imageAlt`)}
      />
    ),
    content: (
      <HeroSlidePanel
        slide={slide}
        collectionName={t(`slides.${slide.key}.tab`)}
        eyebrow={t(`slides.${slide.key}.eyebrow`)}
        description={[
          t(`slides.${slide.key}.title1`),
          t(`slides.${slide.key}.title2`),
          t(`slides.${slide.key}.body`),
        ].join(' ')}
        cta={t(`slides.${slide.key}.cta`)}
        secondaryCta={t('newArrivals')}
      />
    ),
  }));

  return (
    <section
      {...{ [HEADER_BOUNDARY_ATTR]: '' }}
      data-surface="ink"
      aria-labelledby="hero-heading"
      aria-roledescription="carousel"
      className="relative -mt-(--header-h) h-svh min-h-[100svh] overflow-hidden bg-bg text-text"
    >
      <h1 id="hero-heading" className="sr-only">
        {t('heading')}
      </h1>
      <HeroCarousel
        slides={slides}
        tabListLabel={t('tabList')}
        playbackLabels={{ pause: t('pause'), play: t('play') }}
      />
    </section>
  );
}

interface HeroSlideMediaProps {
  slide: HeroSlide;
  /** The first slide: the page's LCP image, the only eager one. */
  lead: boolean;
  imageAlt: string;
}

interface HeroSlidePanelProps {
  slide: HeroSlide;
  /** Dominant display H2: the collection name (Evening, Linen, Abaya, Knitwear). */
  collectionName: string;
  /** Supporting eyebrow (e.g. "New collection", "Summer collection"). */
  eyebrow: string;
  /** `title1`, `title2` and `body` space-joined: the slide's one prose paragraph. */
  description: string;
  cta: string;
  /** `home.hero.newArrivals`: the quieter second way in, the same on every slide. */
  secondaryCta: string;
}

/**
 * Photographic Stage: the full hero, edge to edge, at every breakpoint.
 * Square architectural edges (rounded-none).
 *
 * Two scrims, both horizontal bands, so the photograph is never divided into a lit
 * half and a dark half. The old inline-start wash was 52% of the frame wide at 95%
 * opacity and read as a panel painted onto the image, which is the one thing a
 * campaign hero must not have. What replaces it: a quiet header band on top, and
 * one floor gradient the masthead stands on at every width. The floor stops short
 * of the top, so the upper eighth of every photograph is untouched.
 *
 * **The floor's stops are tuned against the masthead's height, not by eye alone.**
 * The copy block's top edge sits roughly 300px (phones) / 410px (desktop) above the
 * frame's floor, which lands it near the gradient's `via` stop in both cases — about
 * 0.75 alpha. Re-check both numbers if the type scale or the bottom padding changes,
 * and re-check contrast at 1440 and 375 after any photograph swap.
 */
function HeroSlideMedia({ slide, lead, imageAlt }: HeroSlideMediaProps) {
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
    <div className="absolute inset-0">
      <picture className="absolute inset-0 block">
        <source media={WIDE_CROP_MEDIA} srcSet={wide.srcSet} sizes={wide.sizes} />
        <img
          {...portrait}
          alt={alt}
          data-hero-image=""
          className={cn('h-full w-full object-cover rounded-none', slide.imageClassName)}
        />
      </picture>
      {/* Header band: enough to carry the ivory logo and nav, no more */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-linear-to-b from-bg/60 to-transparent"
      />
      {/* Campaign floor: the one scrim the masthead and the collection index stand on */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[92%] lg:h-[88%] bg-linear-to-t from-bg/95 from-0% via-bg/78 via-48% to-transparent to-100%"
      />
    </div>
  );
}

/**
 * Editorial Anchor: a campaign masthead standing on the floor of the photograph.
 * Homepage Phase 2 (2026-09-25, the Claude Design direction):
 *
 * - The eyebrow is the design system's `Eyebrow` — a gold rule and the season label in
 *   the surface accent (Champagne on Espresso). The rule is what carries the role in
 *   Arabic, where there is no uppercase.
 * - The collection name is the page's largest type, `type-display md:type-display-xl`
 *   (the one sanctioned two-`type-*` pairing), now in **sentence case**: the design
 *   system uppercases eyebrows and control labels only (plan D5).
 * - Two ways in: the collection as an Ivory button (the primary action inverts on a
 *   dark surface) and "Shop new arrivals" as an underlined editorial link.
 *
 * The line mask under the name carries more padding in Arabic: Amiri's marks sit
 * lower than Instrument Serif's descenders, and 0.12em clipped them.
 */
function HeroSlidePanel({
  slide,
  collectionName,
  eyebrow,
  description,
  cta,
  secondaryCta,
}: HeroSlidePanelProps) {
  return (
    <div className="max-w-full">
      <div data-enter="fade" className="[--entrance-delay:120ms]">
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>

      <h2 className="mt-4 sm:mt-5 type-display md:type-display-xl text-text">
        <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em] rtl:-mb-[0.3em] rtl:pb-[0.3em]">
          <span data-enter="line" className="block [--entrance-delay:240ms]">
            {collectionName}
          </span>
        </span>
      </h2>

      {/* One upright paragraph: subtitle and body, never italic (Tajawal has none) */}
      <p
        data-enter="fade"
        className="type-body-lg text-text-secondary mt-4 sm:mt-5 max-w-[38ch] line-clamp-3 sm:line-clamp-none [--entrance-delay:420ms]"
      >
        {description}
      </p>

      <div
        data-enter="fade"
        className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 lg:mt-8 [--entrance-delay:560ms]"
      >
        <Link href={slide.href} className={buttonClassName({ variant: 'primary' })}>
          {cta}
        </Link>
        <EditorialLink href="/new-in" underline="always">
          {secondaryCta}
        </EditorialLink>
      </div>
    </div>
  );
}
