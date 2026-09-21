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
 * `/collections` below its intro, composed by count (`collectionIndexLayout`):
 * the opening card at the full container width, then one grid — 2-up from 768,
 * 3-up from 1024 (owner decision, 2026-09-21: the 2-up cards were too large for
 * a directory). Every card is a photograph with its name over it, so the index
 * has one vocabulary whatever the collections carry.
 */
export function CollectionIndex({ collections, locale, exploreLabel }: CollectionIndexProps) {
  const blocks = collectionIndexLayout(collections);

  return (
    <Container as="div" className="pb-(--section-space)">
      {blocks.map((block, index) => {
        const spacing = index === 0 ? undefined : 'mt-16 md:mt-20';

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

        return (
          <Reveal
            key={block.collections.map((c) => c.slug).join('+')}
            className={cn(
              'grid gap-x-5 gap-y-10 [--motion-rise:40px] md:grid-cols-2 lg:grid-cols-3 lg:gap-x-6',
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
                // The stagger runs across a row and restarts on the next, so a
                // late card never waits on the whole grid before it rises.
                className={cn(
                  i % 2 === 1 && 'md:[--motion-stagger:1]',
                  i % 3 === 1 && 'lg:[--motion-stagger:1]',
                  i % 3 === 2 && 'lg:[--motion-stagger:2]'
                )}
              />
            ))}
          </Reveal>
        );
      })}
    </Container>
  );
}
