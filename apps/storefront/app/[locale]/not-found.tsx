import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buttonClassName } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { CategoryDirectory } from '@/features/catalog/components/category-directory';
import { loadCategoryCounts } from '@/features/collections/api/load-category-counts';
import { Link } from '@/i18n/navigation';

/** "Page not found · Moon Fashion": the tab and history said only "Moon Fashion" (QA pass). */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound');
  return { title: t('title') };
}

/**
 * Every unknown URL, and every missing product, category or collection ("Directory",
 * 2026-09-27): the title, one line and a way into the shop on the inline start, and the five
 * categories as photographs beside it, so a dead end becomes a way in. The counts are the
 * catalogue's own and are left out when it cannot answer.
 */
export default async function NotFound() {
  const [t, counts] = await Promise.all([getTranslations('notFound'), loadCategoryCounts()]);

  return (
    <Container
      as="section"
      aria-labelledby="not-found-title"
      className="pt-10 pb-20 md:pt-14 md:pb-24 lg:pt-16 lg:pb-28"
    >
      <div className="grid gap-y-12 lg:grid-cols-12 lg:items-start lg:gap-x-6">
        <div className="lg:col-span-4 lg:pt-1">
          <p className="type-label text-brand" aria-hidden="true">
            404
          </p>
          <h1 id="not-found-title" className="type-page-title mt-3">
            {t('title')}
          </h1>
          <p className="type-body-lg mt-3 max-w-md text-text-secondary">{t('body')}</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link href="/shop" className={buttonClassName()}>
              {t('shopAll')}
            </Link>
            <EditorialLink href="/" underline="always">
              {t('backHome')}
            </EditorialLink>
          </div>
        </div>
        <CategoryDirectory
          counts={counts}
          variant="tiles"
          withHeading
          className="lg:col-span-7 lg:col-start-6"
        />
      </div>
    </Container>
  );
}
