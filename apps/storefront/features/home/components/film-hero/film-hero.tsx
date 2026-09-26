import Image, { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import { HEADER_BOUNDARY_ATTR } from '@/components/layout/header/header-boundary';
import { buttonClassName } from '@/components/ui/button';
import { EditorialLink } from '@/components/ui/editorial-link';
import { Eyebrow } from '@/components/ui/section-header';
import { QuickAdd } from '@/features/cart/components/quick-add';
import { getQuickAddStrings } from '@/features/cart/utils/bag-strings';
import { toQuickAddModel } from '@/features/cart/utils/quick-add-model';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { fromCatalogDto } from '@/features/products/utils/product-card-model';
import { ProductImagePlaceholder } from '@/features/products/components/product-image-placeholder';
import { formatPrice } from '@/features/products/utils/price';
import { fillTemplate } from '@/lib/utils/fill-template';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { editorialImages } from '@/lib/editorial/images';
import { collectionHref, filmFrame, homeCollections } from '../../data/home-collections';

/** By shape, not width: a 4:3 laptop or a portrait tablet takes the portrait crop. */
const WIDE_CROP_MEDIA = '(min-aspect-ratio: 3/2)';

/**
 * 01 — The film's opening frame (homepage "Shop the Film", owner decision 2026-09-26).
 * One full-screen photograph, not a carousel: the page's first screen is a single scene
 * with its title, two ways in, and **the credits** — the pieces of the collection it
 * shows, each with its price and Add to Bag, running along the foot of the frame like a
 * film's credits (`loadFilmCredits`; with no catalogue the row is simply absent).
 *
 * The root carries `HEADER_BOUNDARY_ATTR`, which makes the header transparent over it,
 * and pulls itself up under the header's flow slot by `--header-h`. The photograph is the
 * page's LCP image and the only eager one. The copy stands on the frame's floor over one
 * gradient, at the inline start; the photograph is never mirrored.
 *
 * The credits are two rows on phones, two columns of two from 768 and one row of four
 * from 1280 — never a scroller, because a scroller clips the Quick Add panel (MED-6).
 * Their Quick Add is a light island on Espresso, so its wrapper sets
 * `data-surface="ivory"` (the disc and its panel are drawn for light grounds); the panel
 * opens upward, over the frame. A sold-out piece shows the word and no action, as a tile
 * does.
 */
export async function FilmHero({
  locale,
  credits,
}: {
  locale: AppLocale;
  credits: CatalogProduct[] | null;
}) {
  const t = await getTranslations('home.film');
  const tp = await getTranslations('products');
  const tpr = await getTranslations('product');
  const quickAddStrings = credits ? await getQuickAddStrings(locale) : null;

  const common = {
    alt: t('imageAlt'),
    sizes: '100vw',
    loading: 'eager',
    fetchPriority: 'high',
  } as const;
  const { props: wide } = getImageProps({ ...common, src: editorialImages[filmFrame.wide].src });
  const {
    props: { alt, ...portrait },
  } = getImageProps({ ...common, src: editorialImages[filmFrame.portrait].src });

  return (
    <section
      {...{ [HEADER_BOUNDARY_ATTR]: '' }}
      data-surface="ink"
      aria-labelledby="film-title"
      className="relative isolate -mt-(--header-h) flex min-h-[100svh] flex-col justify-end overflow-hidden bg-bg text-text"
    >
      <picture className="absolute inset-0 -z-10 block">
        <source media={WIDE_CROP_MEDIA} srcSet={wide.srcSet} sizes={wide.sizes} />
        <img
          {...portrait}
          alt={alt}
          data-film-image=""
          className="entrance-settle h-full w-full object-cover object-top"
        />
      </picture>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-bg/55 from-0% via-transparent via-20% to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[78%] bg-linear-to-t from-bg from-0% via-bg/80 via-40% to-transparent"
      />

      <div className="px-(--page-gutter) pt-(--header-h) pb-8 lg:pb-10">
        <div className="entrance-fade-up max-w-[46rem]">
          <Eyebrow>{t('eyebrow')}</Eyebrow>
          <h1 id="film-title" className="type-display-xl mt-5 text-text">
            {t('title')}
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link
              href={collectionHref(homeCollections.film)}
              className={buttonClassName({ variant: 'primary' })}
            >
              {t('cta')}
            </Link>
            <EditorialLink href="/new-in" underline="always">
              {t('secondary')}
            </EditorialLink>
          </div>
        </div>

        {credits && quickAddStrings && (
          <div className="mt-12 border-t border-border pt-5 lg:mt-16 xl:grid xl:grid-cols-[10rem_1fr] xl:items-center xl:gap-6">
            <h2 className="type-label mb-3 text-brand xl:mb-0">{t('credits')}</h2>
            <ul role="list" className="grid gap-3 md:grid-cols-2 md:gap-x-6 xl:grid-cols-4">
              {credits.map((dto, index) => {
                const model = fromCatalogDto(dto, locale);
                const foreign = model.name.lang !== locale;
                return (
                  <li
                    key={dto.slug}
                    className={`grid-cols-[3.5rem_1fr_auto] items-center gap-3.5 ${index < 2 ? 'grid' : 'hidden md:grid'}`}
                  >
                    <span className="relative block aspect-4/5 overflow-hidden rounded-media bg-surface-media">
                      {model.primary?.kind === 'remote' ? (
                        <Image
                          src={model.primary.url}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <ProductImagePlaceholder />
                      )}
                    </span>
                    <span className="grid min-w-0">
                      <Link
                        href={model.href ?? collectionHref(homeCollections.film)}
                        className="type-supporting truncate font-medium text-text hover:text-brand"
                        {...(foreign ? { lang: model.name.lang, dir: 'auto' as const } : {})}
                      >
                        {model.name.text}
                      </Link>
                      {model.price !== null && (
                        <span className="type-supporting tabular-nums text-text-secondary">
                          {model.priceFrom
                            ? fillTemplate(tpr.raw('priceFrom') as string, {
                                price: formatPrice(model.price, locale, tp('currency')),
                              })
                            : formatPrice(model.price, locale, tp('currency'))}
                        </span>
                      )}
                    </span>
                    {dto.inStock ? (
                      <div data-surface="ivory" className="bg-transparent">
                        <QuickAdd
                          product={toQuickAddModel(dto, locale)}
                          strings={quickAddStrings}
                          placement="above"
                        />
                      </div>
                    ) : (
                      <span className="type-caption text-text-secondary">{tp('soldOut')}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
