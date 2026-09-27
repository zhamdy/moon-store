import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { localizedName } from '@/features/products/utils/localized-name';
import { homeCategories } from '../data/home-categories';
import type { CatalogCollection } from '../types/catalog-collection';
import { collectionMeta } from '../utils/collection-meta';

const LINK =
  'type-body inline-flex min-h-10 items-center transition-colors duration-fast ease-ui hover:text-text-secondary';

/**
 * The footer's two directory columns ("Directory", owner decision 2026-09-27), handed to the
 * footer by the layout as one `ReactNode` so `components/layout` imports no feature slice:
 * **Shop** (All pieces, New In and the five homepage categories) and **Collections** (the
 * live ones the header names, each with its season · year, then All collections). The
 * collections come from the layout's one `loadNavCollections` read; `null` drops that
 * column, never a stand-in list. The fragment's two `nav`s are the footer grid's own items.
 */
export async function FooterDirectory({
  locale,
  collections,
}: {
  locale: AppLocale;
  collections: CatalogCollection[] | null;
}) {
  const [t, tn, tc] = await Promise.all([
    getTranslations('footer'),
    getTranslations('navigation'),
    getTranslations('categories'),
  ]);

  return (
    <>
      <nav aria-labelledby="footer-shop" className="lg:col-span-2 lg:col-start-5">
        <h2 id="footer-shop" className="type-eyebrow text-brand">
          {t('shopLabel')}
        </h2>
        <ul role="list" className="mt-4">
          <li>
            <Link href="/shop" className={LINK}>
              {tn('allPieces')}
            </Link>
          </li>
          <li>
            <Link href="/new-in" className={LINK}>
              {tn('newIn')}
            </Link>
          </li>
          {homeCategories.map((category) => (
            <li key={category.key}>
              <Link href={category.href} className={LINK}>
                {tc(category.messageKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {collections && (
        <nav aria-labelledby="footer-collections" className="lg:col-span-3 lg:col-start-7">
          <h2 id="footer-collections" className="type-eyebrow text-brand">
            {tn('collectionsHeading')}
          </h2>
          <ul role="list" className="mt-4">
            {collections.map((collection) => {
              const name = localizedName(collection, locale);
              const foreign = name.lang !== locale;
              const meta = collectionMeta(collection);
              return (
                <li key={collection.slug}>
                  <Link
                    href={`/collections/${collection.slug}`}
                    className="group flex min-h-10 flex-wrap items-baseline gap-x-3 py-1"
                  >
                    <span
                      lang={foreign ? name.lang : undefined}
                      dir={foreign ? 'auto' : undefined}
                      className="type-body transition-colors duration-fast ease-ui group-hover:text-text-secondary"
                    >
                      {name.text}
                    </span>
                    {meta && <span className="type-caption text-text-secondary">{meta}</span>}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/collections"
                className={`${LINK} underline decoration-text-secondary decoration-1 underline-offset-4`}
              >
                {tn('allCollections')}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </>
  );
}
