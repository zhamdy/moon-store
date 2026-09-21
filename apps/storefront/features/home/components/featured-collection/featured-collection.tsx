import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 05 - Featured collection: the experimental layout.
 *
 * From 1024: a large 3:2 image in columns 1-7; the copy block top-right in 8-12,
 * dropped below the photograph's top edge rather than aligned to it; a small 4:5
 * image that starts in that column, is pulled back over the large image by more
 * than a third of its width and runs past its bottom edge. The 7/5 split (it was
 * 8/4) buys the copy column the width `type-h1` needs and makes the overlap the
 * composition's subject rather than a detail.
 *
 * Below 1024 it is recomposed, not stacked: the large image full width, then the
 * title at the inline start beside the small image, which is pulled up to overlap
 * the large image's bottom edge at the inline end, then the link.
 *
 * What the copy block renders (2026-09-21): a gold rule, the collection name and
 * one paragraph. It used to render four levels — the `eyebrow` message ("Featured
 * collection") as the h2, a rule, the `title` message ("The Evening Edit") beneath
 * it at `type-h4`, then the body — which named the section after its CMS label and
 * pushed the collection down to subtitle weight. The name is now the h2 the section
 * is named by and the `eyebrow` message is not rendered here at all; the key stays
 * in both catalogues. The `type-h4` level went with it: three prose sizes in a
 * column this narrow read as a stack, not a hierarchy. The rule moves above the
 * title, which is the Silk Edit's vocabulary, so the page's two signature moments
 * rhyme.
 *
 * Gold: the rule, and the link's hover. On this flat espresso surface gold is
 * 6.14:1 and champagne 8.88:1 — unlike over a photograph, where gold falls under
 * the body threshold and the Silk Edit keeps it out of text entirely.
 *
 * Choreography, one Reveal: the large image opens first, the rule draws, the title
 * rises word by word, the paragraph follows, the small image rises into its overlap
 * later, and the link arrives last. On scroll the small image travels faster than
 * the page (element parallax), so the overlap deepens as the section passes.
 */
export async function FeaturedCollection() {
  const t = await getTranslations('home.featured');

  return (
    <section
      data-surface="dark"
      aria-labelledby="featured-title"
      className="overflow-hidden bg-dark-surface py-20 text-text lg:py-28"
    >
      <Container as="div">
        <Reveal className="grid-editorial" amount={0.2}>
          <div
            data-motion="image"
            className="relative isolate col-span-4 aspect-3/2 overflow-hidden rounded-media bg-dark-surface lg:col-span-7"
          >
            <div data-motion-zoom="" className="absolute inset-0">
              <Image
                src={editorialImages['featured-large'].src}
                alt={t('largeAlt')}
                fill
                sizes="(min-width: 1440px) 790px, (min-width: 1024px) 56vw, 100vw"
                placeholder="blur"
                className="object-cover"
              />
            </div>
          </div>

          <div className="relative col-span-4 grid grid-cols-12 items-start gap-x-4 md:gap-x-6 lg:col-span-5 lg:col-start-8 lg:block">
            <div className="col-span-7 pt-6 md:pt-10 lg:pt-14">
              {/* The section's one gold detail, opening the block — the Silk Edit's
                  vocabulary, so the page's two signature moments rhyme. */}
              <div
                aria-hidden="true"
                data-motion="fade"
                className="h-px w-12 bg-metallic [--motion-offset:360ms]"
              />
              {/* h2 size below 1024 so the title sits comfortably beside the image;
                  a responsive pair, so the lg: variant wins deterministically. */}
              <TextReveal
                as="h2"
                id="featured-title"
                text={t('title')}
                offset={440}
                step={90}
                className="type-h2 lg:type-h1 mt-6 text-balance text-text"
              />
              <p
                data-motion="rise"
                className="type-body-lg mt-5 max-w-[34ch] text-text-secondary [--motion-offset:700ms] [--motion-rise:24px]"
              >
                {t('body')}
              </p>
            </div>

            <Parallax
              mode="element"
              travel={0.08}
              className="relative col-span-5 -mt-16 md:-mt-28 lg:mt-14 lg:-ms-[38%] lg:w-[118%]"
            >
              <div
                data-motion="rise"
                className="relative aspect-4/5 [--motion-duration:1100ms] [--motion-offset:750ms] [--motion-rise:80px]"
              >
                <div
                  data-motion="image"
                  className="absolute inset-0 isolate overflow-hidden rounded-media bg-dark-surface [--motion-offset:750ms]"
                >
                  <div data-motion-zoom="" className="absolute inset-0 [--motion-offset:750ms]">
                    <Image
                      src={editorialImages['featured-small'].src}
                      alt={t('smallAlt')}
                      fill
                      sizes="(min-width: 1440px) 500px, (min-width: 1024px) 38vw, 40vw"
                      placeholder="blur"
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            </Parallax>

            <div
              data-motion="rise"
              className="col-span-12 mt-8 [--motion-offset:1100ms] [--motion-rise:16px] lg:mt-8"
            >
              <EditorialLink
                href="/collections"
                underline="always"
                className="min-h-11 gap-4 pb-2 uppercase tracking-[0.12em] rtl:tracking-normal text-text transition-colors duration-fast ease-ui hover:text-luxury focus-visible:text-luxury"
              >
                {t('link')}
              </EditorialLink>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
