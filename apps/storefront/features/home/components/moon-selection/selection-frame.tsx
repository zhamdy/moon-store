import Image from 'next/image';
import { editorialImages } from '@/lib/editorial/images';
import type { CatalogSlot } from '@/lib/editorial/slots';
import { cn } from '@/lib/utils/cn';

export interface SelectionFrameProps {
  /** The front view, always the default. */
  primary: CatalogSlot;
  /** The alternate view, revealed on hover where hovering exists. */
  secondary: CatalogSlot;
  /** The aspect utility this piece is cropped to (`features/home/data/moon-selection.ts`). */
  frame: string;
  /** Honest `sizes` for the width this frame actually renders at. */
  sizes: string;
  /**
   * `image` wipes the photograph open and settles it from 1.06 — the section's one
   * editorial beat, and the feature's alone. Every other frame rises with its tile.
   */
  reveal?: 'image';
}

/**
 * One photograph in The Moon Selection, with its alternate view behind it.
 *
 * The photographs are **decorative** (`alt=""`): the tile's own link is named by the
 * piece's name and price, so a second description of the same garment would be read out
 * twice. That is the `ProductCard` contract too, and it is why hover carries no
 * information — the alternate view is a second look at a garment the caption has
 * already named, never a fact a shopper needs.
 *
 * `.hover-alt-image` (`app/globals.css`) is `display: none` below 768 and wherever
 * `(hover: hover)` is false, so the second photograph is never *fetched* on a phone,
 * which has no hover to reveal it and no reason to pay for it.
 *
 * The radius is the site-wide `rounded-media` (12px). The brief asked for no card
 * shells, and there are none — no border, no shadow, no plate — but the radius stays:
 * it is what every other photograph on this page carries, and squaring only these five
 * would make the section read as a different site rather than a quieter chapter of this
 * one. Flipping that is one token per frame.
 */
export function SelectionFrame({ primary, secondary, frame, sizes, reveal }: SelectionFrameProps) {
  return (
    <div
      data-motion={reveal === 'image' ? 'image' : undefined}
      className={cn('relative isolate overflow-hidden rounded-media bg-surface-soft', frame)}
    >
      <div data-motion-zoom={reveal === 'image' ? '' : undefined} className="absolute inset-0">
        {/* The scale lives on its own wrapper: a `transition-*` utility replaces an
            element's whole `transition-property`, so a hover transition on the element
            carrying `data-motion` would make its reveal snap (CLAUDE.md -> Motion). */}
        <div className="absolute inset-0 transition-transform duration-base ease-ui group-hover:scale-[1.03]">
          <Image
            src={editorialImages[primary].src}
            alt=""
            fill
            sizes={sizes}
            placeholder="blur"
            className="object-cover"
          />
          <div className="hover-alt-image absolute inset-0">
            <Image
              src={editorialImages[secondary].src}
              alt=""
              fill
              sizes={sizes}
              placeholder="blur"
              className="object-cover opacity-0 transition-opacity duration-base ease-ui group-hover:opacity-100"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
