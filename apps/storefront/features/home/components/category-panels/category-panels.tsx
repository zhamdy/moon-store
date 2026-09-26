import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { homeCategories } from '@/features/collections/data/home-categories';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';

const HEADING_ID = 'category-panels-title';

/**
 * 03 — Shop by category as five tall panels (homepage "Shop the Film", 2026-09-26).
 * From 1024 the panels share one row: Dresses is open (five parts of the width, the
 * others one each) and whichever panel the pointer or focus is on opens instead, the
 * rest collapsing to a spine with the category name set vertically. **Pure CSS**
 * (`[data-panels]` in `app/globals.css`, a `:has()` on the row): no client boundary, no
 * state. Below 1024 they are five stacked 96px rows, name at the inline start.
 *
 * Each panel is one link named by its category (the spine and the "Shop …" cue are
 * `aria-hidden`), to `/shop/<category>`. The photographs are decorative (`alt=""`): the
 * link text says where it goes, and a description of each crop would only repeat it.
 * Without `:has()` the first panel simply stays open.
 */
export async function CategoryPanels() {
  const t = await getTranslations('home.panels');
  const tc = await getTranslations('categories');

  return (
    <Container as="section" aria-labelledby={HEADING_ID} className="pb-(--section-space-commerce)">
      <Reveal className="[--motion-rise:24px]">
        <h2
          id={HEADING_ID}
          data-motion="rise"
          className="type-page-title border-b border-border pb-5 [--motion-rise:16px]"
        >
          {t('title')}
        </h2>
        <ul role="list" data-panels="" className="mt-8 lg:mt-10">
          {homeCategories.map((category, index) => {
            const name = tc(category.messageKey);
            return (
              <li
                key={category.key}
                data-panel=""
                data-motion="fade"
                style={{ '--motion-stagger': index } as React.CSSProperties}
              >
                <Link
                  href={category.href}
                  data-surface="ink"
                  className="group relative isolate flex h-full overflow-hidden rounded-media bg-bg text-text"
                >
                  <Image
                    src={editorialImages[category.image].src}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    placeholder="blur"
                    className="-z-10 object-cover object-[50%_30%] transition-transform duration-slow ease-ui group-hover:scale-[1.03]"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 bg-linear-to-r from-bg/80 via-bg/35 to-transparent rtl:bg-linear-to-l lg:bg-linear-to-t lg:from-bg/85 lg:via-bg/20 lg:via-45% lg:rtl:bg-linear-to-t"
                  />
                  <span
                    data-panel-full=""
                    className="flex w-full items-center justify-between gap-4 px-5 lg:items-end lg:p-8"
                  >
                    <span className="type-title lg:type-display whitespace-nowrap">{name}</span>
                    <span
                      aria-hidden="true"
                      className="type-label flex shrink-0 items-center gap-2 whitespace-nowrap"
                    >
                      <span className="hidden lg:inline">{t('cta', { category: name })}</span>
                      <ArrowUpRight className="size-5 rtl:-scale-x-100" strokeWidth={1.5} />
                    </span>
                  </span>
                  <span
                    data-panel-spine=""
                    aria-hidden="true"
                    className="type-title absolute inset-x-0 bottom-8 hidden justify-center lg:flex"
                  >
                    <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
                      {name}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </Container>
  );
}
