import { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import { HEADER_BOUNDARY_ATTR } from '@/components/layout/header/header-boundary';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 01 — Hero (guideline §12·01). The page's thesis: a dusk-toned full-viewport
 * image, ivory copy at inline-start bottom, the gold logo and ivory nav floating
 * over it. The root carries `HEADER_BOUNDARY_ATTR`, which is what makes the
 * header transparent (see header-shell.tsx), and pulls itself up under the
 * header's flow slot by `--header-h`.
 *
 * The only art-directed and the only eager image on the page: two crops via
 * `getImageProps()` into one `<picture>`, `loading="eager"` + `fetchPriority=
 * "high"`, no blur (irrelevant for an eager LCP image, and incompatible with
 * `<picture>` anyway). Contrast is code-guaranteed by two soft ink scrims — near
 * invisible on a correctly dark image, visible only when a swapped asset is too
 * light (docs/design/editorial-image-brief.md, "Contrast zones").
 *
 * The entrance runs from the server HTML with staggered CSS delays (guideline
 * §12 "Hero motion"), so it needs no JS and never blocks interaction.
 */
export async function Hero() {
  const t = await getTranslations('home.hero');

  const common = {
    alt: t('imageAlt'),
    sizes: '100vw',
    loading: 'eager',
    fetchPriority: 'high',
  } as const;
  const { props: desktop } = getImageProps({ ...common, src: editorialImages['hero-desktop'].src });
  const {
    props: { alt, ...mobile },
  } = getImageProps({ ...common, src: editorialImages['hero-mobile'].src });

  return (
    <section
      {...{ [HEADER_BOUNDARY_ATTR]: '' }}
      data-surface="ink"
      aria-labelledby="hero-title"
      className="relative -mt-(--header-h) flex min-h-svh flex-col justify-end overflow-hidden bg-bg text-text lg:min-h-[88svh]"
    >
      <picture className="absolute inset-0 block">
        <source media="(min-width: 768px)" srcSet={desktop.srcSet} sizes={desktop.sizes} />
        {/* A raw <img> as the direct child of <picture> is the documented art-direction
            form of getImageProps(); @next/next/no-img-element exempts exactly this nesting. */}
        <img
          {...mobile}
          alt={alt}
          className="entrance-settle h-full w-full object-cover object-[70%_25%] [--entrance-delay:100ms] md:object-[75%_20%]"
        />
      </picture>

      {/* Header band scrim, ≤ 35% at the top edge and gone by ~30% of the height. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[30%] bg-linear-to-b from-scrim/85 to-transparent"
      />
      {/* Copy zone scrim, bottom-start. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-scrim to-transparent"
      />

      <Container as="div" className="relative w-full pt-(--header-h) pb-16 lg:pb-24">
        <div className="max-w-2xl">
          <p className="type-label entrance-fade-up text-text-secondary [--entrance-delay:200ms]">
            {t('eyebrow')}
          </p>
          {/* Two authored lines, each in its own overflow mask so a wrapped line at
              320px is never clipped by its neighbour. type-display below md,
              type-display-xl at md+: a responsive pair, where Tailwind emits the
              md: variant after the base utility, so the winner is deterministic. */}
          <h1 id="hero-title" className="type-display md:type-display-xl mt-5 text-balance">
            <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
              <span className="entrance-line block [--entrance-delay:300ms]">{t('title1')}</span>
            </span>
            <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
              <span className="entrance-line block [--entrance-delay:380ms]">{t('title2')}</span>
            </span>
          </h1>
          <p className="type-body-lg entrance-fade-up mt-6 max-w-md text-text/85 [--entrance-delay:450ms]">
            {t('body')}
          </p>
          <EditorialLink
            href="/collections"
            className="entrance-fade-up mt-8 [--entrance-delay:550ms]"
          >
            {t('cta')}
          </EditorialLink>
        </div>
      </Container>
    </section>
  );
}
