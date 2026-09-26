import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { Eyebrow } from '@/components/ui/section-header';
import { localizedName } from '@/features/products/utils/localized-name';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import { homeCategories } from '../data/home-categories';
import type { CatalogCollection } from '../types/catalog-collection';
import { collectionFrame } from '../utils/collection-frame';
import { collectionMeta } from '../utils/collection-meta';

/**
 * The header's navigation content (header direction B, 2026-09-26), rendered on the
 * server and handed to the header's two islands as `ReactNode`s: the desktop panels to
 * `DesktopNav`, the menu sections to `MobileMenu`. Neither island resolves a message or
 * reads the catalogue; `components/layout` imports no feature slice, the layout composes
 * these in the way it composes the Bag.
 *
 * Categories are the homepage's five (`homeCategories`, held to real catalogue keys by
 * `commerce-hrefs.test.ts`); collections are the live ones from `loadNavCollections`,
 * featured first, and `null` drops every collections block rather than inventing one. A
 * collection with no image of its own shows the portrait crop of the same stand-in its
 * chapter on the collections index shows (`collectionFrame`).
 */

const NEW_IN_HREF = '/new-in';
const ALL_PIECES_HREF = '/shop';
const ALL_COLLECTIONS_HREF = '/collections';
/**
 * The New In card's photograph: an editorial slot nothing else in the panels shows
 * (`moment` became the Silk collection's portrait stand-in, 2026-09-26).
 */
const NEW_IN_IMAGE = 'lookbook-04';

interface NavProps {
  locale: AppLocale;
  collections: CatalogCollection[] | null;
}

/** Its photograph in the frame's shape: the 4:5 thumbnails take the portrait crop. */
function collectionImage(collection: CatalogCollection, crop: 'portrait' | 'wide' = 'portrait') {
  const frame = collectionFrame(collection);
  return frame.kind === 'remote' ? frame.url : editorialImages[frame[crop]].src;
}

function CollectionName({
  collection,
  locale,
  className,
}: {
  collection: CatalogCollection;
  locale: AppLocale;
  className: string;
}) {
  const name = localizedName(collection, locale);
  const foreign = name.lang !== locale;
  return (
    <span
      lang={foreign ? name.lang : undefined}
      dir={foreign ? 'auto' : undefined}
      className={className}
    >
      {name.text}
    </span>
  );
}

/** One collection as a row: a 4:5 thumbnail, the name and its season · year. */
function CollectionRow({
  collection,
  locale,
  size,
}: {
  collection: CatalogCollection;
  locale: AppLocale;
  size: 'panel' | 'menu';
}) {
  const meta = collectionMeta(collection);
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group grid grid-cols-[auto_1fr] items-center gap-5 py-2.5"
    >
      <span
        className={cn(
          'relative block aspect-4/5 overflow-hidden rounded-media bg-surface-media',
          size === 'panel' ? 'w-16' : 'w-12'
        )}
      >
        <Image
          src={collectionImage(collection)}
          alt=""
          fill
          sizes="64px"
          className="object-cover transition-transform duration-base ease-ui group-hover:scale-[1.04]"
        />
      </span>
      <span className="grid gap-0.5">
        <CollectionName
          collection={collection}
          locale={locale}
          className={size === 'panel' ? 'type-title' : 'type-body'}
        />
        {meta && <span className="type-caption text-text-secondary">{meta}</span>}
      </span>
    </Link>
  );
}

/** Desktop: the Shop panel — categories, collections and a New In card. */
export async function ShopPanel({ locale, collections }: NavProps) {
  const t = await getTranslations('navigation');
  const tc = await getTranslations('categories');

  return (
    <Container as="div" className="grid grid-cols-12 gap-x-6 py-12">
      <div className="col-span-3 grid content-start">
        <p className="type-eyebrow mb-5 text-text-secondary">{t('categoriesHeading')}</p>
        <ul role="list" className="grid">
          {homeCategories.map((category) => (
            <li key={category.key}>
              <Link
                href={category.href}
                className="type-title inline-block py-1.5 transition-colors duration-fast ease-ui hover:text-brand"
              >
                {tc(category.messageKey)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <EditorialLink href={ALL_PIECES_HREF} underline="always">
            {t('allPieces')}
          </EditorialLink>
        </div>
      </div>

      {collections && (
        <div className="col-span-4 border-s border-border ps-10">
          <p className="type-eyebrow mb-3 text-text-secondary">{t('collectionsHeading')}</p>
          <ul role="list">
            {collections.map((collection) => (
              <li key={collection.slug}>
                <CollectionRow collection={collection} locale={locale} size="panel" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={NEW_IN_HREF}
        className="group col-span-4 col-start-9 grid grid-cols-[10rem_1fr] items-end gap-6 self-start"
      >
        <span className="relative block aspect-4/5 overflow-hidden rounded-media bg-surface-media">
          <Image
            src={editorialImages[NEW_IN_IMAGE].src}
            alt=""
            fill
            sizes="160px"
            placeholder="blur"
            className="object-cover transition-transform duration-base ease-ui group-hover:scale-[1.04]"
          />
        </span>
        <span className="grid gap-2 pb-1">
          <Eyebrow>{t('newIn')}</Eyebrow>
          <span className="type-title">{t('newInTitle')}</span>
          <span className="type-supporting text-text-secondary">{t('newInBody')}</span>
        </span>
      </Link>
    </Container>
  );
}

/** Desktop: the Collections panel — the live collections as cards, and a way to all of them. */
export async function CollectionsPanel({
  locale,
  collections,
}: {
  locale: AppLocale;
  collections: CatalogCollection[];
}) {
  const t = await getTranslations('navigation');

  return (
    <Container as="div" className="py-12">
      <div className="mb-8 flex items-end justify-between gap-8">
        <p className="type-eyebrow text-text-secondary">{t('collectionsHeading')}</p>
        <EditorialLink href={ALL_COLLECTIONS_HREF} underline="always">
          {t('allCollections')}
        </EditorialLink>
      </div>
      <ul role="list" className="grid grid-cols-4 gap-6">
        {collections.map((collection) => {
          const meta = collectionMeta(collection);
          return (
            <li key={collection.slug}>
              <Link href={`/collections/${collection.slug}`} className="group grid gap-4">
                <span className="relative block aspect-4/3 overflow-hidden rounded-media bg-surface-media">
                  <Image
                    src={collectionImage(collection, 'wide')}
                    alt=""
                    fill
                    sizes="(min-width: 1440px) 310px, 22vw"
                    className="object-cover transition-transform duration-base ease-ui group-hover:scale-[1.03]"
                  />
                </span>
                <span className="grid gap-1">
                  <CollectionName collection={collection} locale={locale} className="type-title" />
                  {meta && <span className="type-caption text-text-secondary">{meta}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}

/** Mobile menu: the categories under Shop, each with its thumbnail, then All pieces. */
export async function MenuShopSection() {
  const t = await getTranslations('navigation');
  const tc = await getTranslations('categories');

  return (
    <ul role="list" className="grid grid-cols-2 gap-x-4 gap-y-3 pb-5">
      {homeCategories.map((category) => (
        <li key={category.key}>
          <Link href={category.href} className="flex min-h-15 items-center gap-3">
            <span className="relative block aspect-4/5 w-12 shrink-0 overflow-hidden rounded-media bg-surface-media">
              <Image
                src={editorialImages[category.image].src}
                alt=""
                fill
                sizes="48px"
                placeholder="blur"
                className="object-cover"
              />
            </span>
            <span className="type-body">{tc(category.messageKey)}</span>
          </Link>
        </li>
      ))}
      <li className="flex items-center">
        <Link
          href={ALL_PIECES_HREF}
          className="type-label inline-flex min-h-(--size-tap) items-center gap-2.5"
        >
          {t('allPieces')}
          <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} className="rtl:rotate-180" />
        </Link>
      </li>
    </ul>
  );
}

/** Mobile menu: the collections under Collections, then All collections. */
export async function MenuCollectionsSection({
  locale,
  collections,
}: {
  locale: AppLocale;
  collections: CatalogCollection[];
}) {
  const t = await getTranslations('navigation');

  return (
    <div className="pb-5">
      <ul role="list">
        {collections.map((collection) => (
          <li key={collection.slug}>
            <CollectionRow collection={collection} locale={locale} size="menu" />
          </li>
        ))}
      </ul>
      <Link
        href={ALL_COLLECTIONS_HREF}
        className="type-label mt-2 inline-flex min-h-(--size-tap) items-center gap-2.5"
      >
        {t('allCollections')}
        <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} className="rtl:rotate-180" />
      </Link>
    </div>
  );
}

/** Mobile menu: the featured collection as one card under the list, when there is one. */
export async function MenuFeatured({ locale, collections }: NavProps) {
  const featured = collections?.find((collection) => collection.isFeatured);
  if (!featured) {
    return null;
  }
  const t = await getTranslations('navigation');

  return (
    <Link
      href={`/collections/${featured.slug}`}
      className="grid grid-cols-[6rem_1fr] items-center gap-4"
    >
      <span className="relative block aspect-4/5 overflow-hidden rounded-media bg-surface-media">
        <Image src={collectionImage(featured)} alt="" fill sizes="96px" className="object-cover" />
      </span>
      <span className="grid gap-1.5">
        <Eyebrow>{t('featured')}</Eyebrow>
        <CollectionName collection={featured} locale={locale} className="type-title" />
      </span>
    </Link>
  );
}
