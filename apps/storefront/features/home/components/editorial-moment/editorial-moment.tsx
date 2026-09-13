import { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 04 — Editorial brand moment (guideline §12·04), full bleed (user decision,
 * 2026-09-14; it was a portrait beside an overlapping statement). The photograph
 * fills the section inside a gentle parallax, and the statement, which is the
 * section's heading, sits on it in ivory: inline-start and vertically centred
 * from 768, at the bottom below that. No link: the guideline's "Explore the
 * story →" is an About-shaped destination (R6).
 *
 * Art-directed like the hero: a 16:9 `moment-wide` crop from 768 and the 4:5
 * `moment` below, through `getImageProps()` into one `<picture>` (lazy, no blur,
 * which `<picture>` cannot take). Contrast is code-guaranteed by a strong ink
 * scrim on the text side — a gradient toward the inline end from 768 that mirrors
 * under RTL, and a bottom-up gradient on mobile. Measured on the current photo at
 * ≥5.7:1 for ivory text in every text position (docs/design/editorial-image-brief.md).
 */
export async function EditorialMoment() {
  const t = await getTranslations('home.moment');

  const common = { alt: t('imageAlt'), sizes: '100vw' } as const;
  const { props: desktop } = getImageProps({ ...common, src: editorialImages['moment-wide'].src });
  const {
    props: { alt, ...mobile },
  } = getImageProps({ ...common, src: editorialImages.moment.src });

  return (
    <section
      aria-labelledby="moment-title"
      data-surface="ink"
      className="relative isolate flex h-[90svh] min-h-[34rem] items-end overflow-hidden bg-bg text-text md:h-[80svh] md:items-center"
    >
      <Parallax travel={0.05} className="absolute inset-0 -z-10">
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

      {/* Mobile: statement at the bottom, scrim rising from it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-scrim-strong to-transparent to-60% md:hidden"
      />
      {/* 768+: statement at inline-start, scrim fading toward the inline end. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-scrim-strong from-0% via-scrim via-40% to-transparent to-75% md:block rtl:bg-linear-to-l"
      />

      <Container as="div" className="relative w-full py-(--section-space)">
        <Reveal
          as="h2"
          id="moment-title"
          effect="mask"
          className="type-h1 max-w-[16ch] text-balance md:max-w-[18ch]"
        >
          {`${t('line1')} ${t('line2')} ${t('line3')}`}
        </Reveal>
      </Container>
    </section>
  );
}
