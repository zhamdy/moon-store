import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/container';
import { benefits } from '../../data/benefits';

/**
 * 09 — Shopping benefits (guideline §12·09), visually restrained: three items
 * in a row separated by hairlines, a label and one line each; stacked with
 * hairlines below 768. The list is a `<ul>`; the heading is screen-reader only.
 */
export async function Benefits() {
  const t = await getTranslations('home.benefits');

  return (
    <Container as="section" aria-labelledby="benefits-title" className="pb-(--section-space)">
      <h2 id="benefits-title" className="sr-only">
        {t('heading')}
      </h2>
      <ul className="grid border-y border-border md:grid-cols-3 md:divide-x md:divide-border">
        {benefits.map((key) => (
          <li
            key={key}
            className="border-b border-border py-7 last:border-b-0 md:border-b-0 md:px-8 md:py-9 md:first:ps-0 md:last:pe-0"
          >
            <h3 className="type-label font-body">{t(`${key}.title`)}</h3>
            <p className="type-small mt-2 max-w-xs text-text-secondary">{t(`${key}.body`)}</p>
          </li>
        ))}
      </ul>
    </Container>
  );
}
