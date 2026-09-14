import { getTranslations } from 'next-intl/server';
import { getDirection, type AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { galleryLayout } from '../utils/gallery-layout';
import { localizedName } from '../utils/localized-name';
import { ProductGalleryViewer } from './product-gallery-viewer';
import { ProductImagePlaceholder } from './product-image-placeholder';

export interface ProductGalleryProps {
  locale: AppLocale;
  product: Pick<CatalogProductDetail, 'name' | 'nameEn' | 'images'>;
}

/**
 * The product photographs (PD-10, owner decision 2026-09-14): resolves every string and
 * the `sizes` model on the server and hands plain values to `ProductGalleryViewer`, the
 * client island that owns thumbnail selection and zoom. The first image is the LCP, so
 * nothing here reveals. No image: the brand-mark frame `ProductCard` also uses.
 */
export async function ProductGallery({ locale, product }: ProductGalleryProps) {
  const model = galleryLayout(product.images);
  if (model.kind === 'empty') {
    return (
      <div className="relative aspect-4/5 overflow-hidden bg-surface-soft">
        <ProductImagePlaceholder />
      </div>
    );
  }

  const t = await getTranslations({ locale, namespace: 'product.gallery' });
  const name = localizedName(product, locale).text;
  const count = model.images.length;

  return (
    <ProductGalleryViewer
      label={t('label')}
      dir={getDirection(locale)}
      thumbSizes={model.kind === 'thumbs' ? model.thumbSizes : undefined}
      images={model.images.map(({ position: n, ...image }) => ({
        ...image,
        alt: n === 1 ? name : t('imageAlt', { name, n, count }),
        thumbLabel: count > 1 ? t('thumbLabel', { n, count }) : undefined,
      }))}
    />
  );
}
