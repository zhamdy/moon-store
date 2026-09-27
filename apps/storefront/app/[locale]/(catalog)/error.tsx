'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';

/**
 * Every catalog route's error state (KD-14): a failed API read (network, timeout,
 * 5xx, an invalid response) lands here. It never renders `error.message` or a code;
 * Next logs the `digest` on the server. `retry()` re-fetches and re-renders the
 * segment. The only strings are `catalog.error`, from the `(catalog)` layout's
 * scoped provider, the one namespace a client file may translate.
 */
export default function CatalogError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations('catalog.error');

  // The 404's left column ("Directory", 2026-09-27) without its categories: this boundary is
  // a client component with only `catalog.error` to read, and the catalogue just failed.
  return (
    <Container as="section" className="pt-10 pb-20 md:pt-14 md:pb-24 lg:pt-16 lg:pb-28">
      <div className="max-w-md">
        <h1 className="type-page-title">{t('title')}</h1>
        <p className="type-body-lg mt-3 text-text-secondary">{t('body')}</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Button variant="primary" onClick={() => retry()}>
            {t('retry')}
          </Button>
          <EditorialLink href="/" underline="always">
            {t('home')}
          </EditorialLink>
        </div>
      </div>
    </Container>
  );
}
