import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import type { HomeCategory } from '../types/home-category';

export interface CategoryTileProps {
  category: HomeCategory;
  /** The localised category name — the tile's single accessible name. */
  label: string;
  sizes: string;
  className?: string;
}

/**
 * Image-led category tile (guideline §12·06: no generic icon cards). A 3:4 frame
 * with the name set in display type at the block-end inside a soft ink scrim so
 * ivory text reads on any photograph; the image scales 1 → 1.03 on hover.
 * Server Component; the image is decorative because the link text names it.
 */
export function CategoryTile({ category, label, sizes, className }: CategoryTileProps) {
  return (
    <Link
      href={category.href}
      className={cn('group relative block aspect-3/4 overflow-hidden bg-surface-soft', className)}
    >
      <Image
        src={editorialImages[category.image].src}
        alt=""
        fill
        sizes={sizes}
        placeholder="blur"
        className="object-cover transition-transform duration-300 ease-ui group-hover:scale-[1.03]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-scrim-strong to-transparent"
      />
      <span className="type-h4 absolute inset-x-0 bottom-0 p-5 text-white lg:p-6">{label}</span>
    </Link>
  );
}
