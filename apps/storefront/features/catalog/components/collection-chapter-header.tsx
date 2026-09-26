import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { CollectionFrameImage } from '@/features/collections/components/collection-frame-image';
import type { CatalogCollection } from '@/features/collections/types/catalog-collection';
import { collectionFrame } from '@/features/collections/utils/collection-frame';
import { collectionMeta } from '@/features/collections/utils/collection-meta';
import { localizedDescription, type LocalizedText } from '@/features/products/utils/localized-name';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';
import type { CatalogIntroHeadings } from '../utils/intro-heading';

/** The frame's box: full-bleed below 1024, six columns from it (`header` art). */
const HEADER_SIZES = '(min-width: 1440px) 644px, (min-width: 1024px) calc(50vw - 60px), 100vw';

function langProps(text: LocalizedText, locale: AppLocale) {
  return text.lang === locale ? {} : { lang: text.lang, dir: 'auto' as const };
}

export interface CollectionChapterHeaderProps {
  collection: CatalogCollection;
  locale: AppLocale;
  /** `catalogIntroHeadings` for the collection: its name as the `h1`, "Collections" linked. */
  headings: CatalogIntroHeadings;
}

/**
 * A collection page's header ("Chapters", owner decision 2026-09-26): the chapter the
 * collections index gives it, standing as the page's intro. The name is the `h1`, the
 * linked "Collections" line under it is the way back up (#200), then the season and the
 * description; the photograph (or its stand-in, see `collectionFrame`) is beside the text
 * from 1024 and full-bleed above it below.
 *
 * A featured collection's header is Midnight, as its chapter on the index is; any other
 * is on the page's Ivory. The piece count and the price range are not repeated here: the
 * listing right under it states both ("6 pieces", "Pieces from 1,800 to 5,500 EGP"), and
 * there they follow the filters. Motion is the commerce entrance (the title rises, the lines fade,
 * the photograph fades), and it sits above the listing's Suspense boundary, so it never
 * waits on the grid.
 */
export function CollectionChapterHeader({
  collection,
  locale,
  headings,
}: CollectionChapterHeaderProps) {
  const { h1, context } = headings;
  const meta = collectionMeta(collection);
  const description = localizedDescription(collection, locale);

  return (
    <header
      data-surface={collection.isFeatured ? 'navy' : undefined}
      className="bg-bg text-text lg:mb-14"
    >
      <Container>
        <Reveal className="grid lg:grid-cols-12 lg:items-center lg:gap-x-6 lg:py-12">
          <div
            data-motion="fade"
            className={cn(
              'relative -mx-(--page-gutter) aspect-4/5 overflow-hidden [--motion-duration:900ms] md:aspect-[16/10] lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:mx-0 lg:aspect-auto lg:h-[30rem] xl:h-[34rem]',
              collection.isFeatured ? 'bg-bg' : 'bg-surface-media'
            )}
          >
            <CollectionFrameImage
              frame={collectionFrame(collection)}
              art="header"
              sizes={HEADER_SIZES}
              priority
            />
          </div>

          <div className="pt-8 pb-10 md:pt-10 md:pb-12 lg:col-span-5 lg:row-start-1 lg:py-0">
            <h1
              {...langProps(h1, locale)}
              data-motion="rise"
              className="type-display [--motion-offset:120ms] [--motion-rise:24px]"
            >
              {h1.text}
            </h1>
            {context && (
              <p
                {...langProps(context.text, locale)}
                data-motion="fade"
                className="type-body-lg mt-3 text-text-secondary [--motion-offset:240ms]"
              >
                {context.href ? (
                  <Link
                    href={context.href}
                    className="underline decoration-1 underline-offset-[0.3em] transition-colors duration-fast ease-ui hover:text-brand"
                  >
                    {context.text.text}
                  </Link>
                ) : (
                  context.text.text
                )}
              </p>
            )}
            {meta && (
              <p
                dir="auto"
                data-motion="fade"
                className="type-label mt-6 text-text-secondary [--motion-offset:300ms] lg:mt-7"
              >
                {meta}
              </p>
            )}
            {description && (
              <p
                {...langProps(description, locale)}
                data-motion="fade"
                className="type-body-lg mt-4 max-w-[34rem] text-pretty [--motion-offset:360ms]"
              >
                {description.text}
              </p>
            )}
          </div>
        </Reveal>
      </Container>
    </header>
  );
}
