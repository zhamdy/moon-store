import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';
import { CategoryTile } from '@/features/collections/components/category-tile';
import { homeCategories } from '@/features/collections/data/home-categories';
import { cn } from '@/lib/utils/cn';
import { SectionHeading } from '../section-heading';

/**
 * 06 — Shop by category (guideline §12·06). Five image-led tiles: from 1024 an
 * asymmetric 4×2 grid whose first tile takes a 2×2 cell; at 768 two columns
 * with the last tile spanning both; below that a horizontal scroll-snap rail at
 * 70vw. The rail needs no focus handling of its own — every tile is a link.
 */
export async function CategoryGrid() {
  const t = await getTranslations('home.categories');
  const tc = await getTranslations('categories');
  const last = homeCategories.length - 1;

  return (
    <Container as="section" aria-labelledby="categories-title" className="section-y">
      <SectionHeading id="categories-title" eyebrow={t('eyebrow')} title={t('title')} />
      <div
        className={cn(
          '-mx-(--page-gutter) mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-(--page-gutter) pb-2 [scrollbar-width:none]',
          'md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0',
          'lg:mt-14 lg:grid-cols-4 lg:gap-8'
        )}
      >
        {homeCategories.map((category, index) => (
          <CategoryTile
            key={category.key}
            category={category}
            label={tc(category.messageKey)}
            sizes={
              index === 0
                ? '(min-width: 1440px) 680px, (min-width: 1024px) 48vw, (min-width: 768px) 48vw, 70vw'
                : '(min-width: 1440px) 320px, (min-width: 1024px) 23vw, (min-width: 768px) 48vw, 70vw'
            }
            className={cn(
              'w-[70vw] shrink-0 snap-start md:w-auto',
              index === 0 && 'lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:h-full',
              index === last && 'md:col-span-2 md:aspect-3/2 lg:col-span-1 lg:aspect-3/4'
            )}
          />
        ))}
      </div>
    </Container>
  );
}
