import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import { collectionFallbackSlot } from '../utils/collection-image';

/**
 * What a collection card renders. The name arrives resolved with its language
 * (the catalog slice maps it with `localizedName`: `products` and `collections`
 * never import each other), and `meta` from `collectionMeta`. `imageUrl` may be
 * null — the card falls back to an editorial photograph rather than dropping to
 * a typographic row (see `collection-image.ts`).
 */
export interface CollectionCardModel {
  slug: string;
  /** Locale-less, `/collections/<slug>`. */
  href: string;
  name: { text: string; lang: AppLocale };
  meta: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
}

export interface CollectionCardProps {
  collection: CollectionCardModel;
  locale: AppLocale;
  /** `catalog.collections.explore`, resolved by the page. */
  exploreLabel: string;
  /**
   * `feature`: the index's opening card, the full container width and the only
   * one that wipes its image open (AD-11). `card`: one of the grid below it,
   * 3-up from 1024 — a landscape 3:2 tile, not a second feature. Portrait tiles
   * belong to products; a collection is a place, and it reads as one wide.
   */
  variant: 'feature' | 'card';
  className?: string;
}

const FEATURE_SIZES =
  '(min-width: 1440px) 1312px, (min-width: 768px) calc(100vw - 64px), calc(100vw - 40px)';
/** Mirrors the index grid: 3-up from 1024, 2-up from 768, one below. */
const CARD_SIZES =
  '(min-width: 1440px) 427px, (min-width: 1024px) calc(33.34vw - 40px), (min-width: 768px) calc(50vw - 42px), calc(100vw - 40px)';

function Name({
  collection,
  locale,
  className,
}: Pick<CollectionCardProps, 'collection' | 'locale'> & { className: string }) {
  const foreign = collection.name.lang !== locale;
  return (
    <h2
      lang={foreign ? collection.name.lang : undefined}
      dir={foreign ? 'auto' : undefined}
      className={cn('text-balance', className)}
    >
      {collection.name.text}
    </h2>
  );
}

/**
 * A collection on the index: the photograph is the card, and the name, its
 * season · year and the Explore cue stand on the floor of it (owner decision,
 * 2026-09-21, replacing the photograph-above-caption card and the image-less
 * typographic row). A collection with no image of its own borrows an editorial
 * lookbook crop, so the index is one vocabulary at every count.
 *
 * **One link per collection, and it is the whole card**: the frame is the `Link`,
 * named by the `h2` inside it, so keyboard and screen-reader users meet a single
 * target and the Explore row is a decorative cue (`aria-hidden`) rather than a
 * second tab stop saying the same thing. Copy sits over the scrim in ivory
 * through `data-surface="ink"` — never a colour set per element.
 *
 * Hover scales the photograph on an inner wrapper, apart from the element
 * carrying `data-motion`: a `transition-*` utility replaces the whole
 * `transition-property`, so sharing one element would make the reveal snap.
 */
export function CollectionCard({
  collection,
  locale,
  exploreLabel,
  variant,
  className,
}: CollectionCardProps) {
  const feature = variant === 'feature';
  const src = collection.imageUrl ?? editorialImages[collectionFallbackSlot(collection.slug)].src;

  const card = (
    <Link
      href={collection.href}
      className={cn(
        'group relative isolate block overflow-hidden rounded-media bg-surface-soft',
        feature ? 'aspect-4/5 md:aspect-16/9' : 'aspect-3/2'
      )}
    >
      <div data-motion-zoom={feature ? '' : undefined} className="absolute inset-0">
        <div className="absolute inset-0 transition-transform duration-slow ease-ui group-hover:scale-[1.03]">
          <Image
            src={src}
            alt=""
            fill
            sizes={feature ? FEATURE_SIZES : CARD_SIZES}
            className="object-cover"
          />
        </div>
      </div>
      {/* The floor the copy stands on; the top of every photograph stays untouched. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-scrim-strong via-scrim/45 to-transparent"
      />
      <div
        data-surface="ink"
        className={cn(
          'absolute inset-0 flex flex-col justify-end',
          feature ? 'p-6 md:p-8 lg:p-10' : 'p-5 md:p-6'
        )}
      >
        <Name
          collection={collection}
          locale={locale}
          className={cn('text-text', feature ? 'type-h2 lg:type-h1' : 'type-h4')}
        />
        {collection.meta ? (
          <p dir="auto" className={cn('type-label text-text-secondary', feature ? 'mt-3' : 'mt-2')}>
            {collection.meta}
          </p>
        ) : null}
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex self-start items-center gap-3 type-label text-text transition-opacity duration-fast ease-ui group-hover:opacity-70',
            feature ? 'mt-6' : 'mt-4'
          )}
        >
          {exploreLabel}
          <ArrowRight size={18} className="rtl:-scale-x-100" />
        </span>
      </div>
    </Link>
  );

  if (feature) {
    return (
      <Reveal as="article" amount={0.2} className={className}>
        <div data-motion="image">{card}</div>
      </Reveal>
    );
  }

  return (
    <article data-motion="rise" className={className}>
      {card}
    </article>
  );
}
