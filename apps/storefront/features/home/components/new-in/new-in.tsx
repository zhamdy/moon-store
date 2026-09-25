import type { CSSProperties } from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { Eyebrow } from '@/components/ui/section-header';
import { QuickAdd } from '@/features/cart/components/quick-add';
import { getQuickAddStrings } from '@/features/cart/utils/bag-strings';
import { toQuickAddModel } from '@/features/cart/utils/quick-add-model';
import { homeCategories } from '@/features/collections/data/home-categories';
import { ProductCard } from '@/features/products/components/product-card';
import { curatedEdit, newArrivals } from '@/features/products/data/home-products';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import {
  fromCatalogDto,
  fromHomeMock,
  type ProductCardModel,
} from '@/features/products/utils/product-card-model';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { editorialImages } from '@/lib/editorial/images';
import { NEW_ARRIVALS_LIMIT } from '../../api/load-new-arrivals';
import { collectionHref, homeCollections, sceneSlot } from '../../data/home-collections';

const HEADING_ID = 'new-in-title';
const CARD_SIZES = '(min-width: 1440px) 320px, (min-width: 1024px) 23vw, 46vw';
/** Only for an API that cannot answer: editorial frames with no price, link or action. */
const FALLBACK = [...newArrivals, ...curatedEdit].slice(0, NEW_ARRIVALS_LIMIT);

/**
 * 02 — The shop, straight under the film (homepage "Shop the Film", 2026-09-26). The
 * newest pieces as a grid rather than a rail, with **a scene from the film cut into it**:
 * The Silk Edit takes a 2×2 cell after the first row on desktop (a full-width frame after
 * the first two cards on phones), so the page stays cinematic while it sells.
 *
 * Above the grid, the category chips — All (New In) and the five homepage categories —
 * are plain links into the shop; they filter nothing in place, because the listing pages
 * already do that properly. "View all" goes to New In.
 *
 * Products are New In's first page (`loadNewArrivals`), eight at most. With no API the
 * static editorial frames stand in, carrying no link, price or Add to Bag (HIGH-1); the
 * scene tile and the chips stay, since they name catalogue keys only.
 *
 * Calm motion: the header rises once, the cards rise 24px with a 70ms step (first four),
 * the scene's photograph wipes open.
 */
export async function NewIn({
  locale,
  products: dtos,
}: {
  locale: AppLocale;
  products: CatalogProduct[] | null;
}) {
  const t = await getTranslations('home.shop');
  const ts = await getTranslations('home.scene');
  const tc = await getTranslations('categories');
  const tp = await getTranslations('products');
  const tpr = await getTranslations('product');
  const quickAddStrings = dtos ? await getQuickAddStrings(locale) : null;

  const items: { key: string; model: ProductCardModel; dto?: CatalogProduct }[] = dtos
    ? dtos.map((dto) => ({ key: dto.slug, model: fromCatalogDto(dto, locale), dto }))
    : FALLBACK.map((mock) => ({ key: mock.id, model: fromHomeMock(mock, locale) }));

  // Visual order: on phones two cards, the scene, the rest; from 1024 four cards, then the
  // scene in a 2×2 cell with the rest flowing beside and under it. DOM order is the
  // desktop order, so the reading and Tab order match the larger layout.
  const orderOf = (index: number) =>
    index < 2 ? 'order-1' : index < 4 ? 'order-3 lg:order-1' : 'order-3';

  const card = ({ key, model, dto }: (typeof items)[number], index: number) => (
    <li
      key={key}
      className={orderOf(index)}
      style={index < 4 ? ({ '--motion-stagger': index } as CSSProperties) : undefined}
    >
      <ProductCard
        product={model}
        locale={locale}
        currencyLabel={tp('currency')}
        badgeLabels={{ new: tp('new'), soldOut: tp('soldOut') }}
        priceFromLabel={tpr.raw('priceFrom') as string}
        sizes={CARD_SIZES}
        meta={model.sizeCount ? tp('sizes', { count: model.sizeCount }) : undefined}
        action={
          dto &&
          quickAddStrings && (
            <QuickAdd product={toQuickAddModel(dto, locale)} strings={quickAddStrings} />
          )
        }
      />
    </li>
  );

  const scene = (
    <li key="scene" className="order-2 col-span-2 lg:row-span-2">
      <Link
        href={collectionHref(homeCollections.scene)}
        data-surface="ink"
        className="group relative isolate block h-full min-h-[24rem] overflow-hidden rounded-media bg-bg text-text"
      >
        <span data-motion="image" className="absolute inset-0 -z-10">
          <Image
            src={editorialImages[sceneSlot].src}
            alt={ts('imageAlt')}
            fill
            sizes="(min-width: 1440px) 664px, (min-width: 1024px) 48vw, 100vw"
            placeholder="blur"
            className="object-cover object-[80%_35%] transition-transform duration-slow ease-ui group-hover:scale-[1.03]"
          />
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-bg/85 via-bg/25 to-transparent lg:bg-linear-to-r lg:from-bg/75 lg:via-bg/20 lg:via-50% lg:to-transparent rtl:lg:bg-linear-to-l"
        />
        <span className="absolute inset-x-0 bottom-0 grid justify-items-start gap-3 p-6 lg:inset-y-0 lg:bottom-auto lg:content-start lg:p-10">
          <Eyebrow>{ts('eyebrow')}</Eyebrow>
          <span className="type-display max-w-[9ch]">{ts('title')}</span>
          <span className="type-label mt-2 underline decoration-1 underline-offset-8">
            {ts('cta')}
          </span>
        </span>
      </Link>
    </li>
  );

  return (
    <Container
      as="section"
      aria-labelledby={HEADING_ID}
      className="pt-10 pb-(--section-space-commerce) lg:pt-14"
    >
      <Reveal className="[--motion-rise:24px] [--motion-step:70ms]">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 border-b border-border pb-5">
          <h2
            id={HEADING_ID}
            data-motion="rise"
            className="type-page-title [--motion-offset:60ms] [--motion-rise:16px]"
          >
            {t('title')}
          </h2>
          <nav
            aria-label={t('chipsLabel')}
            className="-mx-(--page-gutter) order-3 w-[calc(100%+2*var(--page-gutter))] overflow-x-auto px-(--page-gutter) [scrollbar-width:none] lg:order-none lg:mx-0 lg:w-auto lg:overflow-visible lg:px-0"
          >
            <ul role="list" className="flex gap-2">
              <li>
                <Link href="/new-in" aria-current="page" className="chip chip-current">
                  {t('all')}
                </Link>
              </li>
              {homeCategories.map((category) => (
                <li key={category.key}>
                  <Link href={category.href} className="chip">
                    {tc(category.messageKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <EditorialLink href="/new-in" underline="always">
            {t('viewAll')}
          </EditorialLink>
        </div>

        <ul
          role="list"
          className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:mt-10 lg:grid-cols-4"
        >
          {items.slice(0, 4).map(card)}
          {scene}
          {items.slice(4).map((item, i) => card(item, i + 4))}
        </ul>
      </Reveal>
    </Container>
  );
}
