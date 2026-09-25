import type { ReactNode } from 'react';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils/cn';
import {
  CATALOG_GRID_CLASS,
  CATALOG_INDEX_CLASS,
  CATALOG_LAYOUT_CLASS,
} from '../utils/grid-layout';

export interface ProductGridSkeletonProps {
  /** `catalog.loading`, resolved by the page: a Suspense fallback cannot itself suspend. */
  loadingLabel: string;
  /** The same category nav `ProductGrid` renders, so the index column never moves. */
  indexNav?: ReactNode;
  /** Two desktop rows by default. */
  count?: number;
}

/**
 * The `ProductGrid` Suspense fallback (KD-10): the same "Atelier" layout — the index
 * column with the real category nav and the filters' footprint from 1024, the toolbar's
 * height, and the grid geometry — with flat `bg-surface-soft` 4:5 frames and card A's
 * caption: a name bar, a price bar and the meta line. No shimmer: a static tone reads
 * calmer and needs no reduced-motion variant, and it stays distinct from a product with
 * no photograph, which carries the brand mark. Hidden from assistive tech apart from
 * the category nav and one visually hidden status.
 */
export function ProductGridSkeleton({
  loadingLabel,
  indexNav,
  count = 6,
}: ProductGridSkeletonProps) {
  return (
    <Container as="section" className={cn('pb-(--section-space)', CATALOG_LAYOUT_CLASS)}>
      <div className={CATALOG_INDEX_CLASS}>
        {indexNav}
        <div aria-hidden="true" className={cn('hidden lg:grid lg:gap-9', indexNav && 'lg:mt-10')}>
          <span className="block h-24 bg-surface-soft" />
          <span className="block h-56 bg-surface-soft" />
        </div>
      </div>
      <div className={cn('min-w-0', indexNav && 'mt-4 lg:mt-0')}>
        <p role="status" className="sr-only">
          {loadingLabel}
        </p>
        <div aria-hidden="true">
          <div className="-mx-(--page-gutter) flex h-(--size-control) items-center border-y border-border px-(--page-gutter) lg:mx-0 lg:h-16 lg:border-t-0 lg:px-0">
            <span className="block h-3.5 w-20 bg-surface-soft" />
          </div>
          <ul role="list" className={`mt-4 lg:mt-8 ${CATALOG_GRID_CLASS}`}>
            {Array.from({ length: count }, (_, index) => (
              <li key={index}>
                <div className="aspect-4/5 rounded-media bg-surface-soft" />
                {/* Card A's caption at its own line heights: name, price, meta. */}
                <span className="mt-3.5 block h-[1.375rem] w-3/5 bg-surface-soft" />
                <span className="mt-1 block h-[1.375rem] w-24 bg-surface-soft" />
                <span className="mt-0.5 block h-[1.125rem] w-16 bg-surface-soft" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Container>
  );
}
