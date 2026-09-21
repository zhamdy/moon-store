import type { HomeProductMock } from '@/features/products/types/home-product';
import { curatedEdit } from '@/features/products/data/home-products';

/**
 * The frame and the `sizes` for one piece in the spread. Both are complete class
 * strings and complete `sizes` strings rather than anything assembled at runtime:
 * Tailwind's scanner finds a candidate only as a whole word in a source file, and an
 * honest `sizes` has to name the real rendered width, which only the composition knows.
 */
export interface SelectionPiece {
  product: HomeProductMock;
  /** The aspect utility its photograph is cropped to. */
  frame: string;
  sizes: string;
}

/**
 * The Moon Selection's composition (owner brief, 2026-09-21).
 *
 * **Every ratio is portrait or square, and that is a constraint, not a preference.**
 * All nine catalog slots are authored at 4:5 (`lib/editorial/slots.ts`), and each frame
 * is `aspect-ratio` + `object-cover`, so a landscape crop of a 4:5 garment shot throws
 * away more than half the frame's height — a hem or a face, depending on the piece. The
 * brief asks for varied proportions; 4:5, 3:4, 1:1 and 5:6 are the variation this
 * photography can carry. Anything wider needs a re-crop in
 * `docs/design/editorial-image-brief.md` first, and the screenshot review as the guard.
 *
 * The five pieces are the ones this section already carried, unchanged, from
 * `features/products/data/home-products.ts` — same slugs, prices, names and photographs.
 * See that file, and the section component's header, for what those mocks do and do not
 * agree with in the seeded catalogue.
 */

/**
 * The embroidered evening dress leads: the section's highest-value piece, the one
 * evening look among five, and already this section's feature card. It keeps the 4:5
 * crop its photograph was authored at, so the piece a shopper is being introduced to is
 * the one frame on the page that crops nothing.
 */
export const selectionFeature: SelectionPiece = {
  product: curatedEdit[0],
  frame: 'aspect-4/5',
  sizes: '(min-width: 1440px) 780px, (min-width: 1024px) 57vw, 92vw',
};

/**
 * The four supporting pieces in reading order. The first two stack in the column beside
 * the feature; the last two make the wide row under it. Their ratios alternate tall,
 * square, tall, square-ish so no two neighbours share a shape.
 */
export const selectionSupporting: readonly SelectionPiece[] = [
  {
    product: curatedEdit[1],
    frame: 'aspect-3/4',
    sizes: '(min-width: 1440px) 432px, (min-width: 1024px) 31vw, (min-width: 420px) 45vw, 92vw',
  },
  {
    product: curatedEdit[2],
    frame: 'aspect-square',
    sizes: '(min-width: 1440px) 432px, (min-width: 1024px) 31vw, (min-width: 420px) 45vw, 92vw',
  },
  {
    product: curatedEdit[3],
    frame: 'aspect-5/6',
    sizes: '(min-width: 1440px) 548px, (min-width: 1024px) 39vw, (min-width: 420px) 45vw, 92vw',
  },
  {
    product: curatedEdit[4],
    frame: 'aspect-3/4',
    sizes: '(min-width: 1440px) 432px, (min-width: 1024px) 31vw, (min-width: 420px) 45vw, 92vw',
  },
];
