import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';
import { collectionHref, looks } from '../../data/home-collections';

const HEADING_ID = 'looks-title';

/** Stepped heights from 1024: the row reads as three frames of a sequence, not a grid. */
const FRAME = ['lg:h-[45rem]', 'lg:h-[36rem] lg:mt-24', 'lg:h-[29rem] lg:mt-48'] as const;

/**
 * 05 — Looks, the film's closing frames (homepage "Shop the Film", 2026-09-26). Three
 * lookbook photographs at stepped heights from 1024, a snap rail below it. Each is one
 * link, named by its title, **to the collection it belongs to** — never to a named
 * product: a look is styling, and the pieces in the photograph are not catalogue items
 * the page could honestly link (HIGH-1). The pill on the photograph says so ("Shop the
 * collection") and is `aria-hidden`, so a look is a single tab stop.
 *
 * No per-item reveal: on phones the rail's off-screen frames never intersect until
 * swiped (CLAUDE.md → Motion), so only the heading rises.
 */
export async function Looks() {
  const t = await getTranslations('home.looks');

  return (
    <section aria-labelledby={HEADING_ID} className="pt-(--section-space) pb-(--section-space)">
      <Container as="div">
        <Reveal>
          <h2
            id={HEADING_ID}
            data-motion="rise"
            className="type-display border-b border-border pb-5 [--motion-rise:16px]"
          >
            {t('title')}
          </h2>
        </Reveal>
        <ul
          role="list"
          className="-mx-(--page-gutter) mt-8 flex snap-x snap-mandatory scroll-px-(--page-gutter) gap-4 overflow-x-auto px-(--page-gutter) [scrollbar-width:none] lg:mx-0 lg:mt-12 lg:grid lg:snap-none lg:grid-cols-3 lg:items-start lg:gap-6 lg:overflow-visible lg:px-0"
        >
          {looks.map((look, index) => (
            <li
              key={look.key}
              className="w-[78vw] max-w-[24rem] shrink-0 snap-start lg:w-auto lg:max-w-none"
            >
              <Link href={collectionHref(look.collection)} className="group block">
                <span
                  className={`relative isolate block aspect-[4/5] overflow-hidden rounded-media bg-surface-media lg:aspect-auto ${FRAME[index]}`}
                >
                  <Image
                    src={editorialImages[look.slot].src}
                    alt={t(`${look.key}.imageAlt`)}
                    fill
                    sizes="(min-width: 1440px) 440px, (min-width: 1024px) 31vw, 78vw"
                    placeholder="blur"
                    className="object-cover transition-transform duration-slow ease-ui group-hover:scale-[1.03]"
                  />
                  <span
                    data-surface="ivory"
                    aria-hidden="true"
                    className="absolute start-4 bottom-4"
                  >
                    <span className="type-label inline-flex min-h-11 items-center rounded-[var(--radius-pill)] bg-bg px-5 text-text shadow-(--shadow-overlay)">
                      {t('cta')}
                    </span>
                  </span>
                </span>
                <span className="type-title mt-4 block group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                  {t(`${look.key}.title`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
