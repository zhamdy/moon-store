import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import type { StorePolicies } from '../types/store-policies';
import { langProps } from '../utils/localized-name';
import { productInfo, type DetailsRow } from '../utils/product-details-model';

export interface ProductInfoProps {
  locale: AppLocale;
  product: CatalogProductDetail;
  /** `null` when the policies read failed: the Shipping & returns fold is simply absent. */
  policies: StorePolicies | null;
  /** Listing hrefs built by the page, so this slice never imports `features/catalog`. */
  hrefs: { category: string | null; collections: Record<string, string> };
}

const LINK =
  'underline underline-offset-4 transition-colors duration-fast ease-ui hover:text-text-secondary';

function Fold({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group border-t border-border">
      <summary className="type-label flex min-h-13 cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        {label}
        <Plus aria-hidden="true" size={16} strokeWidth={1.5} className="group-open:hidden" />
        <Minus aria-hidden="true" size={16} strokeWidth={1.5} className="hidden group-open:block" />
      </summary>
      <div className="type-supporting pb-6">{children}</div>
    </details>
  );
}

/**
 * Everything under Add to Bag in the info column ("In its chapter", owner decision
 * 2026-09-26, replacing the ED-4 tabs): a short facts list, then two native `<details>`
 * folds, "More about this piece" (the description after its lead, so it is said once) and
 * "Shipping & returns". Built on the server from real data only (`productInfo`): an empty
 * row or fold is not rendered, and with nothing at all this renders nothing.
 */
export async function ProductInfo({ locale, product, policies, hrefs }: ProductInfoProps) {
  const { rows, more, shipping } = productInfo(product, policies, locale);
  if (rows.length === 0 && !more && shipping.length === 0) return null;
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
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {links.map((link) => (
              <li key={link.slug}>{anchor(link)}</li>
            ))}
          </ul>
        );
      }
      case 'values':
        return (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {row.values.map((value) => (
              <li key={value} dir="auto">
                {value}
              </li>
            ))}
          </ul>
        );
    }
  }

  return (
    <div data-product-info className="border-b border-border">
      {rows.length > 0 && (
        <dl className="type-supporting space-y-2 border-t border-border pt-5 pb-5">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4">
              <dt className="text-text-secondary">{t(row.id)}</dt>
              <dd>{rowValue(row)}</dd>
            </div>
          ))}
        </dl>
      )}

      {more && (
        <Fold label={t('more')}>
          <div {...langProps(more, locale)} className="max-w-[34rem] space-y-3">
            {more.paragraphs.map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
        </Fold>
      )}

      {shipping.length > 0 && (
        <Fold label={t('shipping')}>
          <div className="max-w-[34rem] space-y-4">
            {shipping.map((section) => (
              <div key={section.id}>
                <p className="font-medium">{t(section.id)}</p>
                <div {...langProps(section, locale)} className="mt-1 space-y-2">
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-line text-text-secondary">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Fold>
      )}
    </div>
  );
}
