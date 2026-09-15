import type { ComponentType } from 'react';
import { getTranslations } from 'next-intl/server';
import { XIcon } from '@/components/brand/x-icon';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import type { AppLocale } from '@/i18n/routing';
import { resolveSiteUrl } from '@/lib/site-url';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { localizedName } from '../utils/localized-name';
import { productShareLinks, type ShareNetwork } from '../utils/share-links';
import { ShareButton } from './share-button';

type ShareIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

/** Keyed so a network added to `ShareNetwork` fails to compile until it has an icon. */
const shareIcons: Record<ShareNetwork, ShareIcon> = {
  x: XIcon,
  whatsapp: WhatsAppIcon,
};

// One share row per page, so a fixed id is unique; the list is named by the visible label.
const LABEL_ID = 'product-share-label';

export interface ProductShareProps {
  locale: AppLocale;
  product: CatalogProductDetail;
}

/**
 * "Share it:", server-rendered links to X and WhatsApp, and the share-sheet button (the
 * only client JS here, as its own list item so the row stays one list). The shared URL is
 * absolute, from `SITE_URL`, since it leaves this site. Icons keep the footer's look: 44px
 * hit areas, no chips, secondary text colour darkening on hover, never mirrored in RTL.
 */
export async function ProductShare({ locale, product }: ProductShareProps) {
  const t = await getTranslations({ locale });
  const url = new URL(
    `/${locale}/products/${encodeURIComponent(product.slug)}`,
    resolveSiteUrl()
  ).toString();
  const title = localizedName(product, locale).text;
  const links = productShareLinks({ url, title });

  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <p id={LABEL_ID} className="type-small text-text-secondary">
        {t('product.share.label')}
      </p>
      <ul aria-labelledby={LABEL_ID} className="flex flex-wrap items-center">
        {links.map(({ network, href }) => {
          const Icon = shareIcons[network];
          return (
            <li key={network}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('product.share.on', {
                  network: t(`product.share.networks.${network}`),
                  newTab: t('footer.newTab'),
                })}
                className="flex h-11 w-11 items-center justify-center text-text-secondary transition-colors duration-fast ease-ui hover:text-text"
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              </a>
            </li>
          );
        })}
        <li className="flex items-center gap-x-2">
          <ShareButton
            url={url}
            title={title}
            labels={{
              share: t('product.share.button'),
              copied: t('product.share.copied'),
              copyFailed: t('product.share.copyFailed'),
            }}
          />
        </li>
      </ul>
    </div>
  );
}
