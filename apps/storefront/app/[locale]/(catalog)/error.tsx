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

  return (
    <Container as="section" className="section-y">
      <div className="max-w-xl">
        <h1 className="type-h1 text-balance">{t('title')}</h1>
        <p className="type-body mt-4 text-text-secondary">{t('body')}</p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-6">
          <Button variant="primary" onClick={() => retry()}>
            {t('retry')}
          </Button>
          <EditorialLink href="/">{t('home')}</EditorialLink>
        </div>
      </div>
    </Container>
  );
}
