import { Container } from '@/components/ui/container';
import { CATALOG_GRID_CLASS, CATALOG_TOOLBAR_CLASS } from '../utils/grid-layout';

export interface ProductGridSkeletonProps {
  /** `catalog.loading`, resolved by the page: a Suspense fallback cannot itself suspend. */
  loadingLabel: string;
  /** Two desktop rows by default. */
  count?: number;
}

/**
 * The `ProductGrid` Suspense fallback (KD-10): the same toolbar height and grid
 * geometry, flat `bg-surface-soft` 4:5 frames with a name bar and a price bar. No
 * shimmer: a static tone reads calmer and needs no reduced-motion variant, and it
 * stays distinct from a product with no photograph, which carries the brand mark.
 * Hidden from assistive tech apart from one visually hidden status.
 */
export function ProductGridSkeleton({ loadingLabel, count = 8 }: ProductGridSkeletonProps) {
  return (
    <Container as="section" className="pb-(--section-space)">
      <p role="status" className="sr-only">
        {loadingLabel}
      </p>
      <div aria-hidden="true">
        <div className={CATALOG_TOOLBAR_CLASS}>
          <span className="block h-3.5 w-20 bg-surface-soft" />
        </div>
        <ul role="list" className={`mt-6 md:mt-8 ${CATALOG_GRID_CLASS}`}>
          {Array.from({ length: count }, (_, index) => (
            <li key={index}>
              <div className="aspect-4/5 rounded-media bg-surface-soft" />
              {/* One type-body line tall, like the card's name/price row. */}
              <div className="mt-4 flex h-[1.6rem] items-center justify-between gap-4">
                <span className="block h-3.5 w-3/5 bg-surface-soft" />
                <span className="block h-3.5 w-12 bg-surface-soft" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
