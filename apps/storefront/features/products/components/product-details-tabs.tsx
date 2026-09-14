import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Link } from '@/i18n/navigation';
import { getDirection, type AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import type { StorePolicies } from '../types/store-policies';
import { langProps } from '../utils/localized-name';
import {
  productDetailsTabs,
  tabHasFocusableContent,
  type DetailsRow,
  type DetailsTab,
} from '../utils/product-details-model';
import { ProductTabs } from './product-tabs';

export interface ProductDetailsTabsProps {
  locale: AppLocale;
  product: CatalogProductDetail;
  /** `null` when the policies read failed: the Shipping tab is simply absent. */
  policies: StorePolicies | null;
  /** Listing hrefs built by the page, so this slice never imports `features/catalog`. */
  hrefs: { category: string | null; collections: Record<string, string> };
}

const HEADING_ID = 'product-details-heading';
const LINK =
  'underline underline-offset-4 transition-colors duration-fast ease-ui hover:text-text-secondary';

/**
 * Description / Details / Shipping & returns (ED-4), built on the server from real data
 * only. A tab with nothing to show is not rendered; one tab renders as a plain headed
 * section with no tablist; none renders nothing. The panels are server markup handed to
 * the `ProductTabs` island, which owns only which one is active.
 */
export async function ProductDetailsTabs({
  locale,
  product,
  policies,
  hrefs,
}: ProductDetailsTabsProps) {
  const tabs = productDetailsTabs(product, policies, locale);
  if (tabs.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'product.details' });

  function rowValue(row: DetailsRow): ReactNode {
    switch (row.kind) {
      case 'text':
        return (
          <span {...langProps(row.value, locale)} className="whitespace-pre-line">
            {row.value.text}
          </span>
        );
      case 'links': {
        const links = row.links.map((link) => ({
          ...link,
          href: row.id === 'category' ? hrefs.category : hrefs.collections[link.slug],
        }));
        const anchor = (link: (typeof links)[number]) =>
          link.href ? (
            <Link href={link.href} {...langProps(link.name, locale)} className={LINK}>
              {link.name.text}
            </Link>
          ) : (
            <span {...langProps(link.name, locale)}>{link.name.text}</span>
          );
        if (links.length === 1) return anchor(links[0]);
        return (
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {links.map((link) => (
              <li key={link.slug}>{anchor(link)}</li>
            ))}
          </ul>
        );
      }
      case 'values':
        return (
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {row.values.map((value) => (
              <li key={value} dir="auto">
                {value}
              </li>
            ))}
          </ul>
        );
    }
  }

  function panel(tab: DetailsTab): ReactNode {
    switch (tab.id) {
      case 'description':
        return (
          <div {...langProps(tab, locale)} className="type-body max-w-[40rem] space-y-4">
            {tab.paragraphs.map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
        );
      case 'details':
        return (
          <dl className="max-w-[40rem] divide-y divide-border">
            {tab.rows.map((row) => (
              <div
                key={row.id}
                className="py-4 first:pt-0 last:pb-0 md:grid md:grid-cols-[10rem_minmax(0,1fr)] md:items-baseline md:gap-x-8"
              >
                <dt className="type-label text-text-secondary">{t(row.id)}</dt>
                <dd className="type-body mt-1 md:mt-0">{rowValue(row)}</dd>
              </div>
            ))}
          </dl>
        );
      case 'shipping':
        return (
          <div className="max-w-[40rem] space-y-8">
            {tab.sections.map((section) => (
              <div key={section.id}>
                <h3 className="type-label text-text-secondary">{t(section.id)}</h3>
                <div {...langProps(section, locale)} className="type-body mt-3 space-y-4">
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
    }
  }

  if (tabs.length === 1) {
    const [only] = tabs;
    return (
      <Reveal
        as="section"
        aria-labelledby={HEADING_ID}
        data-product-details=""
        className="border-t border-border pt-8 md:pt-10"
      >
        <div data-motion="fade">
          <h2 id={HEADING_ID} className="type-h3">
            {t(only.id)}
          </h2>
          <div className="mt-6">{panel(only)}</div>
        </div>
      </Reveal>
    );
  }

  const label = t('label');
  return (
    <Reveal as="section" aria-labelledby={HEADING_ID} data-product-details="">
      <h2 id={HEADING_ID} className="sr-only">
        {label}
      </h2>
      <div data-motion="fade">
        <ProductTabs
          label={label}
          dir={getDirection(locale)}
          tabs={tabs.map((tab) => ({
            id: tab.id,
            label: t(tab.id),
            panelHasFocusable: tabHasFocusableContent(tab),
          }))}
          panels={Object.fromEntries(tabs.map((tab) => [tab.id, panel(tab)]))}
        />
      </div>
    </Reveal>
  );
}
