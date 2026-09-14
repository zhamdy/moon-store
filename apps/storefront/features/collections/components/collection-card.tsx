import Image from 'next/image';
import { Reveal } from '@/components/motion/reveal';
import { EditorialLink } from '@/components/ui/editorial-link';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';

/**
 * What a collection card renders. The name arrives resolved with its language
 * (the catalog slice maps it with `localizedName`: `products` and `collections`
 * never import each other), and `meta` from `collectionMeta`.
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
   * `feature`: the index's 7/5 split, stacked below 1024, the only one that wipes
   * its image open (AD-11). `card`: an image card in a 2-up row, rising. `text`:
   * no image, a typographic row. `feature` and `card` need `imageUrl`.
   */
  variant: 'feature' | 'card' | 'text';
  className?: string;
}

const FEATURE_SIZES =
  '(min-width: 1440px) 752px, (min-width: 1024px) calc((100vw - 96px) * 0.57), (min-width: 768px) calc(100vw - 64px), calc(100vw - 40px)';
const CARD_SIZES =
  '(min-width: 1440px) 640px, (min-width: 1024px) calc(50vw - 64px), (min-width: 768px) calc(50vw - 42px), calc(100vw - 40px)';

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

function Meta({ meta, className }: { meta: string | null; className?: string }) {
  return meta ? (
    <p dir="auto" className={cn('type-label text-text-secondary', className)}>
      {meta}
    </p>
  ) : null;
}

/** "Explore" with the collection's name for assistive tech, so every link is distinct. */
function ExploreLink({
  collection,
  locale,
  exploreLabel,
}: Pick<CollectionCardProps, 'collection' | 'locale' | 'exploreLabel'>) {
  const foreign = collection.name.lang !== locale;
  return (
    <EditorialLink href={collection.href}>
      {exploreLabel}
      <span className="sr-only" lang={foreign ? collection.name.lang : undefined}>
        {` ${collection.name.text}`}
      </span>
    </EditorialLink>
  );
}

/**
 * A collection on the index. Content is name, season · year and the link: no
 * product count. The photograph repeats the link for pointer users only
 * (`tabIndex=-1`, `aria-hidden`), so keyboard and screen-reader users meet one
 * link per collection. Hover scales the photograph on an inner wrapper, apart
 * from the element carrying `data-motion`.
 */
export function CollectionCard({
  collection,
  locale,
  exploreLabel,
  variant,
  className,
}: CollectionCardProps) {
  if (variant === 'text' || !collection.imageUrl) {
    return (
      <Reveal
        as="article"
        effect="rise"
        className={cn(
          'flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-t border-border py-10 [--motion-rise:24px] md:py-14',
          className
        )}
      >
        <div className="max-w-2xl">
          <Meta meta={collection.meta} />
          <Name collection={collection} locale={locale} className="type-h2 mt-3" />
        </div>
        <div className="mb-1">
          <ExploreLink collection={collection} locale={locale} exploreLabel={exploreLabel} />
        </div>
      </Reveal>
    );
  }

  const photo = (sizes: string, feature: boolean) => (
    <Link href={collection.href} tabIndex={-1} aria-hidden="true" className="block">
      <div
        data-motion={feature ? 'image' : undefined}
        className={cn(
          'relative overflow-hidden bg-surface-soft',
          feature ? 'aspect-4/5 md:aspect-3/2' : 'aspect-4/5'
        )}
      >
        <div data-motion-zoom={feature ? '' : undefined} className="absolute inset-0">
          <div className="absolute inset-0 transition-transform duration-slow ease-ui group-hover:scale-[1.03]">
            <Image src={collection.imageUrl!} alt="" fill sizes={sizes} className="object-cover" />
          </div>
        </div>
      </div>
    </Link>
  );

  if (variant === 'feature') {
    return (
      <Reveal
        as="article"
        amount={0.2}
        className={cn('group grid gap-y-8 lg:grid-cols-12 lg:items-center lg:gap-x-8', className)}
      >
        <div className="lg:col-span-7">{photo(FEATURE_SIZES, true)}</div>
        <div className="lg:col-span-5">
          <div data-motion="fade" className="[--motion-offset:300ms]">
            <Meta meta={collection.meta} />
          </div>
          <div data-motion="rise" className="mt-3 [--motion-offset:400ms] [--motion-rise:24px]">
            <Name collection={collection} locale={locale} className="type-h2 lg:type-h1" />
          </div>
          <div data-motion="fade" className="mt-8 [--motion-offset:600ms]">
            <ExploreLink collection={collection} locale={locale} exploreLabel={exploreLabel} />
          </div>
        </div>
      </Reveal>
    );
  }

  return (
    <article data-motion="rise" className={cn('group', className)}>
      {photo(CARD_SIZES, false)}
      <div data-motion="fade" className="mt-5 [--motion-offset:240ms]">
        <Meta meta={collection.meta} />
        <Name collection={collection} locale={locale} className="type-h3 mt-2" />
        <div className="mt-4">
          <ExploreLink collection={collection} locale={locale} exploreLabel={exploreLabel} />
        </div>
      </div>
    </article>
  );
}
