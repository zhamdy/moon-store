import type { CSSProperties } from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { galleryLayout, type GallerySlide } from '../utils/gallery-layout';
import { localizedName } from '../utils/localized-name';
import { ProductImagePlaceholder } from './product-image-placeholder';

export interface ProductGalleryProps {
  locale: AppLocale;
  product: Pick<CatalogProductDetail, 'name' | 'nameEn' | 'images'>;
}

const FRAME = 'relative aspect-4/5 overflow-hidden bg-surface-soft';
const COUNT_ID = 'product-gallery-count';

/**
 * The product photographs (PD-10): a Server Component with no JS. One list serves both
 * layouts, so no image downloads twice: from 1024 a two-column grid under a full-width
 * lead, below it a scroll-snap rail with a peek (`[data-gallery]` in `app/globals.css`,
 * geometry in `gallery-layout.ts`). The lead is the LCP image, so nothing here reveals.
 *
 * The rail is a focusable labelled region, so arrow keys scroll it natively; it stays
 * one at 1024+ too, where CSS alone cannot drop the tab stop. Its progress hairline sits
 * outside the scroller and follows it through a named scroll timeline, rendered only
 * where `animation-timeline` is supported. `dir` orders the slides; photographs are
 * never mirrored.
 */
export async function ProductGallery({ locale, product }: ProductGalleryProps) {
  const model = galleryLayout(product.images);
  if (model.kind === 'empty') {
    return (
      <div className={FRAME}>
        <ProductImagePlaceholder />
      </div>
    );
  }

  const name = localizedName(product, locale).text;

  if (model.kind === 'single') {
    return (
      <div className={FRAME}>
        <GalleryImage slide={model.slides[0]} alt={name} />
      </div>
    );
  }

  const t = await getTranslations({ locale, namespace: 'product.gallery' });

  return (
    <div data-gallery style={{ '--gallery-count': model.count } as CSSProperties}>
      <div
        data-gallery-rail
        role="region"
        tabIndex={0}
        aria-label={t('label')}
        aria-describedby={COUNT_ID}
      >
        <ul data-gallery-list>
          {model.slides.map((slide) => (
            <li key={slide.position} data-gallery-slide data-span={slide.span} className={FRAME}>
              <GalleryImage
                slide={slide}
                alt={
                  slide.position === 1
                    ? name
                    : t('imageAlt', { name, n: slide.position, count: model.count })
                }
              />
            </li>
          ))}
        </ul>
      </div>
      <p id={COUNT_ID} className="sr-only">
        {t('count', { count: model.count })}
      </p>
      <div data-gallery-progress aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

function GalleryImage({ slide, alt }: { slide: GallerySlide; alt: string }) {
  return (
    <Image
      src={slide.url}
      alt={alt}
      fill
      sizes={slide.sizes}
      loading={slide.loading}
      fetchPriority={slide.fetchPriority}
      className="object-cover"
    />
  );
}
