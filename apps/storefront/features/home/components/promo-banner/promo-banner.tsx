import { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Parallax } from '@/components/motion/parallax';
import { Container } from '@/components/ui/container';
import { editorialImages } from '@/lib/editorial/images';

/** Where the banner's button goes: a new collection today, an offer page when one exists. */
const BANNER_HREF = '/collections/silk';

/**
 * 04 — Promo banner (user decision, 2026-09-14), in place of the guideline's
 * editorial brand moment (§12·04). A full-bleed photograph announcing a new
 * collection or an offer: a label, a headline, one line and a button.
 *
 * Everything it says lives in `home.banner` in both message catalogues, so turning
 * it into an offer is a copy change plus `BANNER_HREF`. Offer terms (amounts,
 * dates, conditions) must come from the business; never invent them here.
 *
 * Art-directed like the hero: a 16:9 `moment-wide` crop from 768 and the 4:5
 * `moment` below, through `getImageProps()` into one `<picture>` (lazy; no blur,
 * which `<picture>` cannot take). Contrast is code-guaranteed by a strong ink scrim
 * on the copy side, fading toward the inline end from 768 (mirrored under RTL) and
 * rising from the bottom on mobile — measured on the current photo at ≥5.7:1 for
 * ivory text (docs/design/editorial-image-brief.md).
 *
 * Layers are explicit (photo z-0, scrims z-10, copy z-20) and the copy has no
 * reveal animation, so the banner can never render as a bare photograph.
 */
export async function PromoBanner() {
  const t = await getTranslations('home.banner');

  const common = { alt: t('imageAlt'), sizes: '100vw' } as const;
  const { props: desktop } = getImageProps({ ...common, src: editorialImages['moment-wide'].src });
  const {
    props: { alt, ...mobile },
  } = getImageProps({ ...common, src: editorialImages.moment.src });

  return (
    <section
      aria-labelledby="promo-banner-title"
      data-surface="ink"
      className="relative isolate flex h-[90svh] min-h-[34rem] items-end overflow-hidden bg-bg text-text md:h-[80svh] md:items-center"
    >
      <Parallax travel={0.05} className="absolute inset-0 z-0">
        <picture className="absolute inset-0 block">
          <source media="(min-width: 768px)" srcSet={desktop.srcSet} sizes={desktop.sizes} />
          {/* A raw <img> as the direct child of <picture> is the documented art-direction
              form of getImageProps(); @next/next/no-img-element exempts exactly this nesting. */}
          <img
            {...mobile}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover object-[60%_30%] md:object-[70%_30%]"
          />
        </picture>
      </Parallax>

      {/* Mobile: copy at the bottom, scrim rising from it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-linear-to-t from-scrim-strong to-transparent to-60% md:hidden"
      />
      {/* 768+: copy at inline-start, scrim fading toward the inline end. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 hidden bg-linear-to-r from-scrim-strong from-0% via-scrim via-40% to-transparent to-75% md:block rtl:bg-linear-to-l"
      />

      <Container as="div" className="relative z-20 w-full py-(--section-space)">
        <div className="max-w-xl">
          <p className="type-label text-text-secondary">{t('eyebrow')}</p>
          <h2 id="promo-banner-title" className="type-h1 mt-4 text-balance">
            {t('title')}
          </h2>
          <p className="type-body-lg mt-5 max-w-md text-text/85">{t('body')}</p>
          {/* Ivory on the ink surface: bg-text / text-bg invert with the surface. */}
          <Link
            href={BANNER_HREF}
            className="group mt-8 inline-flex min-h-12 items-center gap-3 bg-text px-7 text-bg transition-colors duration-fast ease-ui hover:bg-text/85"
          >
            <span className="type-label">{t('cta')}</span>
            <ArrowRight
              aria-hidden="true"
              size={16}
              className="transition-transform duration-fast ease-ui group-hover:translate-x-1 group-focus-visible:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 rtl:group-focus-visible:-translate-x-1"
            />
          </Link>
        </div>
      </Container>
    </section>
  );
}
