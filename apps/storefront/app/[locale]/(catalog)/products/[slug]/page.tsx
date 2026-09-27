import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { buttonClassName } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import {
  RelatedProducts,
  RelatedProductsSkeleton,
} from '@/features/catalog/components/related-products';
import { catalogPath } from '@/features/catalog/utils/catalog-path';
import { relatedRoute, relatedScope } from '@/features/catalog/utils/related-scope';
import { AddToBagButton } from '@/features/cart/components/add-to-bag-button';
import { getAddToBagStrings } from '@/features/cart/utils/bag-strings';
import { getCatalogProduct } from '@/features/products/api/get-catalog-product';
import { loadStorePolicies } from '@/features/products/api/load-store-policies';
import { ProductBreadcrumb } from '@/features/products/components/product-breadcrumb';
import { ProductDetail } from '@/features/products/components/product-detail';
import { ProductGallery } from '@/features/products/components/product-gallery';
import { ProductInfo } from '@/features/products/components/product-info';
import { ProductShare } from '@/features/products/components/product-share';
import { PurchasePanelSlot } from '@/features/products/components/purchase-panel-slot';
import { langProps, localizedName } from '@/features/products/utils/localized-name';
import { buildProductMetadata } from '@/features/products/utils/product-metadata';

type Props = PageProps<'/[locale]/products/[slug]'>;

/**
 * The active product, or `notFound()` before anything renders (KD-10). One
 * `React.cache`d read serves both the page and `generateMetadata`.
 */
async function resolve(props: Props) {
  // Reads no searchParams, so without this the route would be prerendered and full-route
  // cached at runtime, outside the data-cache lifetime the catalog relies on (PD-8).
  await connection();
  const { locale, slug } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const product = await getCatalogProduct(slug);
  if (!product) notFound();
  return { locale: locale as AppLocale, product };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, product } = await resolve(props);
  const t = await getTranslations({ locale, namespace: 'catalog' });

  return buildProductMetadata({
    locale,
    product,
    fallbackDescription: (name) => t('meta.productDescription', { name }),
  });
}

export default async function ProductPage(props: Props) {
  const { locale, product } = await resolve(props);
  setRequestLocale(locale);
  // Only once the product is known, so it never delays or masks a 404 (KD-10). Contained:
  // a failed read yields null and only drops the Shipping & returns fold.
  const [policies, addToBagStrings, tc] = await Promise.all([
    loadStorePolicies(),
    getAddToBagStrings(locale),
    getTranslations({ locale, namespace: 'catalog' }),
  ]);
  const scope = relatedScope(product);

  const hrefs = {
    category: product.category
      ? catalogPath({ kind: 'category', slug: product.category.slug })
      : null,
    collections: Object.fromEntries(
      product.collections.map((c) => [c.slug, catalogPath({ kind: 'collection', slug: c.slug })])
    ),
  };

  // A sold-out piece ends on the way into its collection (or category), not on a disabled
  // button: the status beside the price already says it cannot be bought.
  let action = (
    <AddToBagButton
      slug={product.slug}
      name={localizedName(product, locale)}
      imageUrl={product.images[0]?.url ?? null}
      strings={addToBagStrings}
    />
  );
  if (!product.inStock && scope) {
    const scopeName = localizedName(scope.entity, locale);
    // Only the name may need its own `lang`, so the template is split around it.
    const [before = '', after = ''] = (tc.raw('collections.exploreName') as string).split('{name}');
    action = (
      <Link
        href={catalogPath(relatedRoute(scope))}
        className={buttonClassName({ variant: 'primary', block: true })}
      >
        {/* One span, so the button's flex row sees one item and keeps the spaces. */}
        <span>
          {before}
          <span {...langProps(scopeName, locale)}>{scopeName.text}</span>
          {after}
        </span>
      </Link>
    );
  }

  return (
    <ProductDetail
      locale={locale}
      product={product}
      breadcrumb={
        <ProductBreadcrumb
          locale={locale}
          product={product}
          hrefs={{ home: '/', shop: catalogPath({ kind: 'all' }), category: hrefs.category }}
        />
      }
      gallery={<ProductGallery locale={locale} product={product} />}
      purchase={
        // The page is the only place both slices meet: `features/products` never imports
        // `features/cart`, so the action is composed here into the panel's slot (CD-11).
        <PurchasePanelSlot key={product.slug} locale={locale} product={product} action={action} />
      }
      details={<ProductInfo locale={locale} product={product} policies={policies} hrefs={hrefs} />}
      share={<ProductShare locale={locale} product={product} />}
      related={
        scope ? (
          <Suspense fallback={<RelatedProductsSkeleton />}>
            <RelatedProducts locale={locale} product={product} />
          </Suspense>
        ) : undefined
      }
    />
  );
}
