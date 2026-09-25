import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import type { HomeCategory } from '../types/home-category';

export interface CategoryTileProps {
  category: HomeCategory;
  /** The localised category name, the tile's accessible name. */
  label: string;
  /** "01": the tile's place in the homepage index, decorative. */
  index: string;
  /** `home.categories.shopCategory` resolved ("Shop dresses"), shown from 1024. */
  cta: string;
  sizes: string;
  className?: string;
}

/**
 * The lead category tile — the large photograph that opens the homepage's category
 * index (homepage Phase 2, 2026-09-25; the homepage is this component's only
 * renderer). On an Espresso surface token, so its type is Ivory and its number
 * Champagne without a colour of its own: the index number, the name in display type
 * and, from 1024, a "Shop dresses" label with an arrow, over one floor gradient.
 *
 * Hover: the photograph scales 1 -> 1.04 and the arrow travels 4px along the reading
 * direction. No Bronze tint (retired with Phase 2: more Bronze than the one-accent rule
 * allows). The image wipe on entrance sits on its own element; the hover scale is on
 * the image itself, so reveal and hover never share an element. The number and the
 * label are `aria-hidden`: the link is named by the category alone.
 */
export function CategoryTile({ category, label, index, cta, sizes, className }: CategoryTileProps) {
  return (
    <Link
      href={category.href}
      data-surface="ink"
      className={cn(
        'group relative isolate block overflow-hidden rounded-media bg-bg text-text',
        className
      )}
    >
      <span data-motion="image" className="absolute inset-0">
        <Image
          src={editorialImages[category.image].src}
          alt=""
          fill
          sizes={sizes}
          placeholder="blur"
          className="object-cover object-[50%_38%] transition-transform duration-base ease-ui group-hover:scale-[1.04]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-bg/80 via-bg/30 to-transparent"
        />
      </span>
      <span className="absolute inset-x-0 bottom-0 grid justify-items-start gap-2 p-5 md:gap-3 lg:p-10">
        <span aria-hidden="true" className="type-caption tabular-nums text-brand" dir="ltr">
          {index}
        </span>
        <span className="type-section-title">{label}</span>
        <span
          aria-hidden="true"
          className="type-label mt-1 hidden items-center gap-2.5 lg:inline-flex"
        >
          {cta}
          <ArrowRight
            aria-hidden="true"
            size={16}
            strokeWidth={1.5}
            className="transition-transform duration-fast ease-ui group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
          />
        </span>
      </span>
    </Link>
  );
}
