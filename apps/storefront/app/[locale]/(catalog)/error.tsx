'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { EmptyState } from '@/components/ui/empty-state';

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
    <Container as="section" className="section-y-commerce">
      <EmptyState
        titleAs="h1"
        title={t('title')}
        body={t('body')}
        actions={
          <>
            <Button variant="primary" onClick={() => retry()}>
              {t('retry')}
            </Button>
            <EditorialLink href="/">{t('home')}</EditorialLink>
          </>
        }
      />
    </Container>
  );
}
