import Image, { getImageProps } from 'next/image';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import type { CollectionFrame } from '../utils/collection-frame';

/**
 * Which crop each width takes. Media queries are by width, and the first match wins:
 *
 * - `chapter` (a chapter on the collections index): 4:5 on phones, the wide crop across
 *   the tablet's full-width frame, 4:5 again beside the text at 1024–1279 (six columns
 *   are too narrow for a landscape crop), and the wide crop in the 7-column frame from 1280.
 * - `header` (a collection page's chapter): 4:5, except the tablet's full-width frame.
 * - `wide`: the wide crop at every width (the More collections cards).
 */
export type CollectionFrameArt = 'chapter' | 'header' | 'wide';

type Crop = 'wide' | 'portrait';

const ART: Record<CollectionFrameArt, { sources: [media: string, crop: Crop][]; base: Crop }> = {
  chapter: {
    sources: [
      ['(min-width: 1280px)', 'wide'],
      ['(min-width: 1024px)', 'portrait'],
      ['(min-width: 768px)', 'wide'],
    ],
    base: 'portrait',
  },
  header: {
    sources: [
      ['(min-width: 1024px)', 'portrait'],
      ['(min-width: 768px)', 'wide'],
    ],
    base: 'portrait',
  },
  wide: { sources: [], base: 'wide' },
};

export interface CollectionFrameImageProps {
  frame: CollectionFrame;
  art: CollectionFrameArt;
  /** Describes the frame box at each width; the same string serves every crop. */
  sizes: string;
  /** The page's largest above-the-fold image: eager, high priority. */
  priority?: boolean;
  className?: string;
}

/**
 * A collection's photograph filling its (positioned) frame. Always decorative
 * (`alt=""`): the collection's name sits beside or under it, and a stand-in crop does
 * not depict the collection anyway. A remote image (the collection's own) has one crop,
 * so it is a plain `Image`; an editorial stand-in with two crops is a `<picture>` built
 * from `getImageProps`, the homepage opening frame's pattern. Portrait crops are pinned
 * to the top: the brief keeps their lower part as empty floor, never the face.
 */
export function CollectionFrameImage({
  frame,
  art,
  sizes,
  priority = false,
  className,
}: CollectionFrameImageProps) {
  const loading = priority
    ? ({ loading: 'eager', fetchPriority: 'high' } as const)
    : ({ loading: 'lazy' } as const);
  const fit = cn('object-cover', className);

  if (frame.kind === 'remote') {
    return <Image src={frame.url} alt="" fill sizes={sizes} {...loading} className={fit} />;
  }

  const { sources, base } = ART[art];
  const crops: Record<Crop, (typeof editorialImages)[keyof typeof editorialImages]['src']> = {
    wide: editorialImages[frame.wide].src,
    portrait: editorialImages[frame.portrait].src,
  };
  const position = (crop: Crop) => (crop === 'portrait' ? 'object-top' : 'object-center');

  // One slot for both shapes (the lookbook fallback), or one crop at every width.
  const used = new Set<Crop>([base, ...sources.map(([, crop]) => crop)]);
  if (frame.wide === frame.portrait || used.size === 1) {
    return (
      <Image
        src={crops[base]}
        alt=""
        fill
        sizes={sizes}
        placeholder="blur"
        {...loading}
        className={cn(position(base), fit)}
      />
    );
  }

  const common = { alt: '', sizes, ...loading };
  const props: Record<Crop, ReturnType<typeof getImageProps>['props']> = {
    wide: getImageProps({ ...common, src: crops.wide }).props,
    portrait: getImageProps({ ...common, src: crops.portrait }).props,
  };
  const { alt, ...img } = props[base];

  return (
    <picture className="absolute inset-0 block">
      {sources.map(([media, crop]) => (
        <source key={media} media={media} srcSet={props[crop].srcSet} sizes={props[crop].sizes} />
      ))}
      <img {...img} alt={alt} className={cn('h-full w-full object-top', fit)} />
    </picture>
  );
}
