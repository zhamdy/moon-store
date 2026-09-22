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
 * geometry, flat `bg-surface-soft` 4:5 frames with a name bar, a price bar, the
 * description's two clamped lines and the Add to Bag block. No
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
              {/* The card's caption and its action, at the card's own heights: name and
                  price on one baseline, two clamped description lines, a 48px button. */}
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <span className="block h-[1.7rem] w-3/5 bg-surface-soft" />
                <span className="block h-[1.36rem] w-20 bg-surface-soft" />
              </div>
              <span className="mt-1.5 block h-[2.72rem] bg-surface-soft" />
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
