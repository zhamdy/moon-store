import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { EditorialLink } from '@/components/ui/editorial-link';
import type { CategoryCounts } from '@/features/collections/api/load-category-counts';
import { homeCategories } from '@/features/collections/data/home-categories';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';
import { formatResultCount } from '../utils/result-count';

/** Hairline rows with a 48px thumbnail: the drawer at every width, a page below 768. */
const ROWS = {
  list: 'divide-y divide-border border-y border-border',
  link: 'group flex min-h-19 items-center gap-3.5 py-2',
  frame:
    'relative block aspect-4/5 w-12 shrink-0 overflow-hidden rounded-media-sm bg-surface-media',
  caption: 'type-body flex flex-1 items-baseline justify-between gap-3',
};

/** The rows below 768, then the five photographs in a row with the name and count under each. */
const TILES = {
  list: `${ROWS.list} md:grid md:grid-cols-5 md:gap-x-4 md:divide-y-0 md:border-0`,
  link: `${ROWS.link} md:block md:min-h-0 md:py-0`,
  frame: `${ROWS.frame} md:w-full md:rounded-media`,
  caption: `${ROWS.caption} md:mt-2.5`,
};

export interface CategoryDirectoryProps {
  /** `loadCategoryCounts()`; `null` shows the categories without counts. */
  counts: CategoryCounts | null;
  /**
   * `tiles`: for a page, the five photographs in a row from 768 and the drawer's rows below.
   * `rows`: 48px thumbnails in hairline rows at every width, for the Bag drawer.
   */
  variant: 'tiles' | 'rows';
  /**
   * Draws the "Shop by category" label and a New In link above the tiles. Without it the
   * list is named for assistive technology only, for a place whose own copy introduces it.
   */
  withHeading?: boolean;
  className?: string;
}

/**
 * "Directory" (owner decision 2026-09-27, chosen from three directions drawn in Claude
 * Design: Still room, Directory, Night frame): a dead end hands the shopper the shop's own
 * map. The five homepage categories with the photographs the header's Shop panel already
 * shows, each with the catalogue's piece count when it could be read.
 *
 * Server-rendered, and handed to the Bag and Checkout islands as a `ReactNode`, the way the
 * header's panels are: the islands resolve no message and read no catalogue. Its links are
 * plain navigations, so the Bag drawer closes on the route change as it does for any link.
 */
export async function CategoryDirectory({
  counts,
  variant,
  withHeading = false,
  className,
}: CategoryDirectoryProps) {
  const [t, tc, tn] = await Promise.all([
    getTranslations('catalog'),
    getTranslations('categories'),
    getTranslations('navigation'),
  ]);
  const label = t('wayfinding.shopByCategory');
  const tiles = variant === 'tiles';
  const headingId = `category-directory-${variant}`;

  const count = (slug: string) => {
    const value = counts?.get(slug);
    if (value === undefined) return null;
    return (
      <>
        <span aria-hidden="true" className="text-text-secondary tabular-nums">
          {value}
        </span>
        <span className="sr-only">{`, ${formatResultCount(t, value)}`}</span>
      </>
    );
  };

  return (
    <nav
      aria-labelledby={withHeading ? headingId : undefined}
      aria-label={withHeading ? undefined : label}
      className={className}
    >
      {withHeading && (
        <div className="mb-4 flex items-baseline justify-between gap-6">
          <h2 id={headingId} className="type-label text-text-secondary">
            {label}
          </h2>
          <EditorialLink href="/new-in" underline="always">
            {tn('newIn')}
          </EditorialLink>
        </div>
      )}

      <ul role="list" className={tiles ? TILES.list : ROWS.list}>
        {homeCategories.map((category) => (
          <li key={category.key}>
            <Link href={category.href} className={tiles ? TILES.link : ROWS.link}>
              <span className={tiles ? TILES.frame : ROWS.frame}>
                <Image
                  src={editorialImages[category.image].src}
                  alt=""
                  fill
                  sizes={
                    tiles ? '(min-width: 1024px) 160px, (min-width: 768px) 20vw, 48px' : '48px'
                  }
                  placeholder="blur"
                  className="object-cover transition-transform duration-base ease-ui group-hover:scale-[1.04]"
                />
              </span>
              <span className={tiles ? TILES.caption : ROWS.caption}>
                <span className="font-medium transition-colors duration-fast ease-ui group-hover:text-brand">
                  {tc(category.messageKey)}
                </span>
                <span className="type-supporting">{count(category.key)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
