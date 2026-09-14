import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';
import { collectionIndexLayout } from '../utils/collection-index-layout';
import { CollectionCard, type CollectionCardModel } from './collection-card';

export interface CollectionIndexProps {
  /** Live collections in the server's order (featured first). Empty: render the empty state instead. */
  collections: CollectionCardModel[];
  locale: AppLocale;
  exploreLabel: string;
}

/**
 * `/collections` below its intro, composed by count (`collectionIndexLayout`): the
 * feature split, then 2-up image rows and typographic rows for image-less
 * collections. Consecutive text rows stack as one ruled list; every other block
 * change gets section-scale air.
 */
export function CollectionIndex({ collections, locale, exploreLabel }: CollectionIndexProps) {
  const blocks = collectionIndexLayout(collections);

  return (
    <Container as="div" className="pb-(--section-space)">
      {blocks.map((block, index) => {
        const previous = blocks[index - 1];
        const next = blocks[index + 1];
        const spacing =
          index === 0
            ? undefined
            : block.kind === 'text' && previous?.kind === 'text'
              ? undefined
              : 'mt-20 md:mt-28';

        if (block.kind === 'feature') {
          return (
            <CollectionCard
              key={block.collection.slug}
              collection={block.collection}
              locale={locale}
              exploreLabel={exploreLabel}
              variant="feature"
              className={spacing}
            />
          );
        }

        if (block.kind === 'text') {
          return (
            <CollectionCard
              key={block.collection.slug}
              collection={block.collection}
              locale={locale}
              exploreLabel={exploreLabel}
              variant="text"
              className={cn(spacing, next?.kind !== 'text' && 'border-b')}
            />
          );
        }

        return (
          <Reveal
            key={block.collections.map((c) => c.slug).join('+')}
            className={cn(
              'grid gap-y-14 [--motion-rise:48px] md:grid-cols-2 md:gap-x-6 lg:gap-x-8',
              spacing
            )}
          >
            {block.collections.map((collection, i) => (
              <CollectionCard
                key={collection.slug}
                collection={collection}
                locale={locale}
                exploreLabel={exploreLabel}
                variant="card"
                className={i === 1 ? 'md:[--motion-stagger:1]' : undefined}
              />
            ))}
          </Reveal>
        );
      })}
    </Container>
  );
}
