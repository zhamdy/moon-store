import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { buttonClassName } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { CollectionFrameImage } from '@/features/collections/components/collection-frame-image';
import { collectionFrame } from '@/features/collections/utils/collection-frame';
import { collectionMeta } from '@/features/collections/utils/collection-meta';
import { formatPrice } from '@/features/products/utils/price';
import { fromCatalogDto } from '@/features/products/utils/product-card-model';
import {
  localizedDescription,
  localizedName,
  type LocalizedText,
} from '@/features/products/utils/localized-name';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';
import { fillTemplate } from '@/lib/utils/fill-template';
import { catalogPath } from '../utils/catalog-path';
import { CHAPTER_CREDITS_COMPACT, type CollectionChapterModel } from '../utils/collection-chapters';
import { formatResultCount } from '../utils/result-count';
import { CollectionFacts } from './collection-facts';

/** The frame's box at each width (`CollectionFrameImage`'s `chapter` art). */
const CHAPTER_SIZES =
  '(min-width: 1440px) 755px, (min-width: 1280px) calc(58.33vw - 66px), (min-width: 1024px) calc(50vw - 60px), (min-width: 768px) calc(100vw - 64px), 100vw';

function langProps(text: LocalizedText, locale: AppLocale) {
  return text.lang === locale ? {} : { lang: text.lang, dir: 'auto' as const };
}

export interface CollectionChapterProps {
  chapter: CollectionChapterModel;
  locale: AppLocale;
  /** The first chapter is usually in view at load: its photograph loads eagerly. */
  priority?: boolean;
}

/**
 * One collection on the collections index ("Chapters", owner decision 2026-09-26, chosen
 * from three directions drawn in Claude Design): its photograph beside its numeral, name,
 * season, description, the first pieces in curated order as **credits** (name, price or
 * Sold out, each a link to the piece), how many more there are, and Explore with the
 * piece count and price range. Everything but the photograph is catalogue data; a
 * collection with no image of its own shows the stand-in `collectionFrame` picks.
 *
 * Below 1024 the photograph is above the text (full-bleed on the Midnight chapter); from
 * 1024 it takes six columns (seven from 1280) on `chapter.side`, the text four or five.
 * The frame is a second, pointer-only link to the collection (`aria-hidden`, out of the
 * tab order): Explore is the one keyboard stop, so a chapter is one collection link plus
 * one per credit.
 */
export async function CollectionChapter({ chapter, locale, priority }: CollectionChapterProps) {
  const t = await getTranslations('catalog');
  const tp = await getTranslations('products');
  const tpr = await getTranslations('product');
  const { collection, credits, surface, side } = chapter;
  const name = localizedName(collection, locale);
  const description = localizedDescription(collection, locale);
  const meta = collectionMeta(collection);
  const href = catalogPath({ kind: 'collection', slug: collection.slug });
  const headingId = `chapter-${collection.slug}`;
  const nocturnal = surface === 'navy';
  const end = side === 'end';

  return (
    <section
      aria-labelledby={headingId}
      data-surface={surface ?? undefined}
      className="bg-bg text-text"
    >
      <Container>
        <Reveal
          amount={0.15}
          className={cn(
            'grid lg:grid-cols-12 lg:items-center lg:gap-x-6',
            nocturnal ? 'pb-14 md:py-16 lg:py-24' : 'py-12 md:py-16 lg:py-24',
            chapter.ruleAbove && 'border-t border-border'
          )}
        >
          <div
            data-motion="image"
            className={cn(
              nocturnal && 'max-md:-mx-(--page-gutter)',
              'lg:row-start-1',
              end
                ? 'lg:col-span-6 lg:col-start-7 xl:col-span-7 xl:col-start-6'
                : 'lg:col-span-6 lg:col-start-1 xl:col-span-7'
            )}
          >
            <Link
              href={href}
              tabIndex={-1}
              aria-hidden="true"
              className={cn(
                'group relative isolate block aspect-4/5 overflow-hidden rounded-media md:aspect-[16/10] lg:aspect-4/5 xl:aspect-[31/24]',
                // The mat under the photograph: on Midnight it is Midnight, so a frame
                // centred on a fractional pixel never shows a light hairline at its edge.
                nocturnal ? 'bg-bg' : 'bg-surface-media'
              )}
            >
              <div data-motion-zoom="" className="absolute inset-0">
                <div className="absolute inset-0 transition-transform duration-slow ease-ui group-hover:scale-[1.03]">
                  <CollectionFrameImage
                    frame={collectionFrame(collection)}
                    art="chapter"
                    sizes={CHAPTER_SIZES}
                    priority={priority}
                  />
                </div>
              </div>
            </Link>
          </div>

          <div
            className={cn(
              'mt-8 lg:row-start-1 lg:mt-0',
              end
                ? 'lg:col-span-5 lg:col-start-1'
                : 'lg:col-span-5 lg:col-start-8 xl:col-span-4 xl:col-start-9'
            )}
          >
            <p
              data-motion="rise"
              className="type-supporting text-accent tabular-nums [--motion-offset:120ms]"
            >
              {chapter.numeral}
            </p>
            <h2
              id={headingId}
              {...langProps(name, locale)}
              data-motion="rise"
              className="type-section-title mt-3 [--motion-offset:160ms] lg:mt-4"
            >
              {name.text}
            </h2>
            {meta && (
              <p
                dir="auto"
                data-motion="fade"
                className="type-label mt-4 text-text-secondary [--motion-offset:240ms]"
              >
                {meta}
              </p>
            )}
            {description && (
              <p
                {...langProps(description, locale)}
                data-motion="fade"
                className="type-body-lg mt-4 max-w-[34rem] text-pretty [--motion-offset:280ms] lg:mt-5"
              >
                {description.text}
              </p>
            )}

            {credits.length > 0 && (
              <div data-motion="fade" className="mt-7 [--motion-offset:340ms] lg:mt-8">
                <h3 className="type-label border-b border-border pb-2.5 text-text-secondary">
                  {t('collections.credits')}
                </h3>
                <ul role="list">
                  {credits.map((dto, index) => {
                    const model = fromCatalogDto(dto, locale);
                    const price =
                      model.price === null
                        ? null
                        : model.priceFrom
                          ? fillTemplate(tpr.raw('priceFrom') as string, {
                              price: formatPrice(model.price, locale, tp('currency')),
                            })
                          : formatPrice(model.price, locale, tp('currency'));
                    return (
                      <li
                        key={dto.slug}
                        className={index >= CHAPTER_CREDITS_COMPACT ? 'max-md:hidden' : undefined}
                      >
                        <Link
                          href={model.href ?? href}
                          className="type-supporting flex min-h-11 items-center gap-3 border-b border-border py-2 transition-colors duration-fast ease-ui hover:text-brand"
                        >
                          <span className="min-w-0" {...langProps(model.name, locale)}>
                            {model.name.text}
                          </span>
                          <span
                            aria-hidden="true"
                            className="h-px min-w-3 flex-1 self-center border-b border-dotted border-current opacity-35"
                          />
                          {!dto.inStock && (
                            <span
                              className={cn(
                                'shrink-0 font-medium',
                                nocturnal ? 'text-text-secondary' : 'text-danger'
                              )}
                            >
                              {tp('soldOut')}
                            </span>
                          )}
                          {price && <span className="shrink-0 tabular-nums">{price}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {chapter.moreCompact > 0 && (
                  <p className="type-supporting mt-3 text-text-secondary md:hidden">
                    {t('collections.more', { count: chapter.moreCompact })}
                  </p>
                )}
                {chapter.more > 0 && (
                  <p className="type-supporting mt-3 text-text-secondary max-md:hidden">
                    {t('collections.more', { count: chapter.more })}
                  </p>
                )}
              </div>
            )}

            <div
              data-motion="fade"
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 [--motion-offset:400ms]"
            >
              <Link
                href={href}
                className={buttonClassName({ variant: 'primary', className: 'max-md:w-full' })}
              >
                {t('collections.exploreName', { name: name.text })}
              </Link>
              <CollectionFacts
                locale={locale}
                count={formatResultCount(t, chapter.total)}
                priceRange={chapter.priceRange}
                currency={tp('currency')}
                className="max-md:w-full max-md:text-center"
              />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
