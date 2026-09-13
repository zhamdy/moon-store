import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';

export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <Container as="section" className="section-y">
      <h1 className="type-display">{t('title')}</h1>
      <p className="type-body text-text-secondary">{t('body')}</p>
      <EditorialLink href="/" className="mt-6">
        {t('backHome')}
      </EditorialLink>
    </Container>
  );
}
