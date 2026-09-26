import { getTranslations } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { listCatalogCollections } from '@/features/collections/api/list-catalog-collections';
import { CollectionFrameImage } from '@/features/collections/components/collection-frame-image';
import type { CatalogCollection } from '@/features/collections/types/catalog-collection';
import { collectionFrame } from '@/features/collections/utils/collection-frame';
import { collectionMeta } from '@/features/collections/utils/collection-meta';
import { localizedName } from '@/features/products/utils/localized-name';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { ApiError } from '@/lib/api/errors';
import { catalogPath } from '../utils/catalog-path';
import { formatResultCount } from '../utils/result-count';

const COLLECTIONS_INDEX = '/collections';

/** Two up from 768, one below: the card's box for the wide crop. */
const CARD_SIZES = '(min-width: 1440px) 644px, (min-width: 768px) calc(50vw - 44px), 100vw';

/** The live collections, or `[]` when the read fails (logged; never the error screen). */
async function loadCollections(current: string): Promise<CatalogCollection[]> {
  try {
    return await listCatalogCollections();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(
        `More collections under "${current}" are hidden: ${error.code} ${error.status}`
      );
      return [];
    }
    throw error;
  }
}

/**
 * The foot of a collection page ("Chapters", owner decision 2026-09-26): the other live
 * collections in the index's order, each its photograph, numeral, name, season and piece
 * count, and a link to all of them. It replaces the listing's end link
 * ("Explore all collections"). With no other live collection, or no list, it renders
 * nothing.
 *
 * Streams in its own Suspense boundary on the page, after the grid's: the list is the
 * cached entity read the index and the header panel also make, and a slow answer never
 * holds the listing back.
 */
export async function MoreCollections({ current, locale }: { current: string; locale: AppLocale }) {
  const t = await getTranslations('catalog');
  const all = await loadCollections(current);
  const others = all
    .map((collection, index) => ({ collection, numeral: String(index + 1).padStart(2, '0') }))
    .filter(({ collection }) => collection.slug !== current);

  // The only live collection, or no list: the page ends on its grid, and the `h1`'s
  // "Collections" line is the way back up.
  if (others.length === 0) return null;

  return (
    <Container as="section" aria-labelledby="more-collections" className="pb-(--section-space)">
      <div className="border-t border-border pt-12 md:pt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <h2 id="more-collections" className="type-section-title">
            {t('collections.moreTitle')}
          </h2>
          <EditorialLink href={COLLECTIONS_INDEX} underline="always">
            {t('collections.all')}
          </EditorialLink>
        </div>
        <Reveal
          as="ul"
          role="list"
          className="mt-8 grid gap-10 [--motion-rise:32px] md:grid-cols-2 md:gap-x-6 lg:mt-10"
        >
          {others.map(({ collection, numeral }, index) => {
            const name = localizedName(collection, locale);
            const meta = collectionMeta(collection);
            const facts = [meta, formatResultCount(t, collection.productCount)].filter(Boolean);
            return (
              <li
                key={collection.slug}
                data-motion="rise"
                className={index % 2 === 1 ? 'md:[--motion-stagger:1]' : undefined}
              >
                <Link
                  href={catalogPath({ kind: 'collection', slug: collection.slug })}
                  className="group block"
                >
                  <span className="relative isolate block aspect-[16/10] overflow-hidden rounded-media bg-surface-media">
                    <span className="absolute inset-0 block transition-transform duration-slow ease-ui group-hover:scale-[1.03]">
                      <CollectionFrameImage
                        frame={collectionFrame(collection)}
                        art="wide"
                        sizes={CARD_SIZES}
                      />
                    </span>
                  </span>
                  <div className="mt-5">
                    <h3 className="type-title transition-colors duration-fast ease-ui group-hover:text-brand">
                      <span
                        aria-hidden="true"
                        className="type-supporting me-3 align-middle text-accent tabular-nums"
                      >
                        {numeral}
                      </span>
                      <span
                        {...(name.lang === locale ? {} : { lang: name.lang, dir: 'auto' as const })}
                      >
                        {name.text}
                      </span>
                    </h3>
                    <span dir="auto" className="type-label mt-2 block text-text-secondary">
                      {facts.join(' · ')}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </Reveal>
      </div>
    </Container>
  );
}
