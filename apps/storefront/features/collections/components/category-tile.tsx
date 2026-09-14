import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import type { HomeCategory } from '../types/home-category';

export interface CategoryTileProps {
  category: HomeCategory;
  /** The localised category name, the tile's single accessible name. */
  label: string;
  sizes: string;
  /**
   * Its entrance inside a `<Reveal>`: `image` wipes the photograph open in place
   * (for a feature tile), `rise` lifts the whole tile (for a supporting one).
   */
  reveal?: 'image' | 'rise';
  className?: string;
}

/**
 * Image-led category tile (no generic icon cards). A 3:4 frame with the name set
 * in display type at the block-end inside a soft ink scrim, so ivory text reads on
 * any photograph. Server Component; the image is decorative because the link text
 * names it.
 *
 * Hover: the photograph scales 1 -> 1.04 and the name shifts along the reading
 * direction. Reveal: the photograph settles from 1.06 and the name rises after it.
 * Reveal and hover motion sit on separate elements because each owns its
 * element's transition.
 */
export function CategoryTile({
  category,
  label,
  sizes,
  reveal = 'rise',
  className,
}: CategoryTileProps) {
  return (
    <Link
      href={category.href}
      data-motion={reveal === 'rise' ? 'rise' : undefined}
      className={cn('group relative block aspect-3/4 overflow-hidden bg-surface-soft', className)}
    >
      <span data-motion={reveal === 'image' ? 'image' : undefined} className="absolute inset-0">
        <span data-motion-zoom="" className="absolute inset-0">
          <Image
            src={editorialImages[category.image].src}
            alt=""
            fill
            sizes={sizes}
            placeholder="blur"
            className="object-cover transition-transform duration-base ease-ui group-hover:scale-[1.04]"
          />
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-scrim-strong to-transparent"
        />
      </span>
      <span
        data-motion="rise"
        className="absolute inset-x-0 bottom-0 p-5 [--motion-offset:380ms] [--motion-rise:20px] lg:p-6"
      >
        <span className="type-h4 block text-white transition-transform duration-base ease-ui group-hover:translate-x-1.5 rtl:group-hover:-translate-x-1.5">
          {label}
        </span>
      </span>
    </Link>
  );
}
