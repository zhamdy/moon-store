import type { ComponentType } from 'react';
import { getTranslations } from 'next-intl/server';
import { Facebook, Mail, Twitter } from 'lucide-react';
import { PinterestIcon } from '@/components/brand/pinterest-icon';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import type { AppLocale } from '@/i18n/routing';
import { resolveSiteUrl } from '@/lib/site-url';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { localizedName } from '../utils/localized-name';
import { productShareLinks, type ShareNetwork } from '../utils/share-links';

type ShareIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

/** Keyed so a network added to `ShareNetwork` fails to compile until it has an icon. */
const shareIcons: Record<ShareNetwork, ShareIcon> = {
  facebook: Facebook,
  x: Twitter,
  pinterest: PinterestIcon,
  whatsapp: WhatsAppIcon,
  email: Mail,
};

export interface ProductShareProps {
  locale: AppLocale;
  product: CatalogProductDetail;
}

/**
 * "Share it:" and plain links to each network's share endpoint. Server-rendered with no
 * client JS, which is also why there is no copy-link button. The shared URL is absolute,
 * from `SITE_URL`, since it leaves this site. Icons keep the footer's look: 44px hit
 * areas, no chips, secondary text colour darkening on hover, never mirrored in RTL.
 */
export async function ProductShare({ locale, product }: ProductShareProps) {
  const t = await getTranslations({ locale });
  const url = new URL(
    `/${locale}/products/${encodeURIComponent(product.slug)}`,
    resolveSiteUrl()
  ).toString();
  const links = productShareLinks({
    url,
    title: localizedName(product, locale).text,
    image: product.images[0]?.url ?? null,
  });

  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <p className="type-small text-text-secondary">{t('product.share.label')}</p>
      <ul aria-label={t('product.share.listLabel')} className="flex flex-wrap">
        {links.map(({ network, href }) => {
          const Icon = shareIcons[network];
          const isEmail = network === 'email';
          return (
            <li key={network}>
              <a
                href={href}
                {...(isEmail ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                aria-label={
                  isEmail
                    ? t('product.share.email')
                    : t('product.share.on', {
                        network: t(`product.share.networks.${network}`),
                        newTab: t('footer.newTab'),
                      })
                }
                className="flex h-11 w-11 items-center justify-center text-text-secondary transition-colors duration-fast ease-ui hover:text-text"
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
