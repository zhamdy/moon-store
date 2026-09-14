import { getLocale, getTranslations } from 'next-intl/server';
import {
  Facebook,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Twitter,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { BrandLogo } from '@/components/brand/brand-logo';
import { hasContactDetails, storeContact, telHref, type SocialNetwork } from '@/lib/brand/contact';
import { NavLink } from '../nav-link';
import { primaryNavItems } from '../navigation-items';

/** One icon per network, keyed so a network added to the type fails to compile until it has one. */
const socialIcons: Record<SocialNetwork, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  whatsapp: MessageCircle,
  x: Twitter,
  youtube: Youtube,
};

/**
 * A deep-ink close (guideline §12·12 "ivory or deep ink"): the gold logo reads
 * best on ink. The lockup with a one-line tagline and the social links, the three
 * shop links, the contact details, and a copyright line under the only gold in the
 * footer, a hairline. `data-surface="ink"` swaps the text/bg/border tokens and the
 * focus ring.
 *
 * Contact and social details come from `lib/brand/contact.ts` (user decision,
 * 2026-09-14) and render only when real values are filled in there: an empty
 * phone, address or social list is simply absent, never a placeholder. There is no
 * language switcher here (the header toggle and the mobile menu carry it), and no
 * FAQ, Blog, About, Newsletter or policy links.
 */
export async function Footer() {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const year = new Date().getFullYear();

  const address = storeContact.address[locale].trim();
  const { e164, display } = storeContact.phone;
  const showContact = hasContactDetails(storeContact, locale);
  const social = storeContact.social;

  return (
    <footer data-surface="ink" className="bg-bg text-text">
      <Container as="div" className="section-y">
        <div className="grid-editorial gap-y-12">
          <div className="col-span-4">
            <Link href="/" aria-label="Moon Fashion" className="inline-block">
              <BrandLogo variant="logo" height={120} />
            </Link>
            <p className="type-body mt-8 max-w-xs text-text-secondary">{t('footer.tagline')}</p>

            {social.length > 0 && (
              <ul aria-label={t('footer.socialLabel')} className="-ms-3 mt-6 flex flex-wrap gap-1">
                {social.map(({ network, url }) => {
                  const Icon = socialIcons[network];
                  return (
                    <li key={network}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t(`footer.networks.${network}`)} (${t('footer.newTab')})`}
                        className="flex h-11 w-11 items-center justify-center text-text-secondary transition-colors duration-fast ease-ui hover:text-text"
                      >
                        <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <nav
            aria-label={t('navigation.footerLabel')}
            className="col-span-2 lg:col-span-3 lg:col-start-7"
          >
            <h2 className="type-label font-body text-text-secondary">{t('footer.shopLabel')}</h2>
            <ul className="mt-6 flex flex-col gap-4">
              {primaryNavItems.map((item) => (
                <li key={item.key}>
                  <NavLink href={item.href} typography="type-body">
                    {t(`navigation.${item.messageKey}`)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {showContact && (
            <div className="col-span-2 lg:col-span-3 lg:col-start-10">
              <h2 className="type-label font-body text-text-secondary">
                {t('footer.contactLabel')}
              </h2>
              <address className="type-body mt-6 flex flex-col gap-4 not-italic">
                {e164 && (
                  <a
                    href={telHref(e164)}
                    className="inline-flex min-h-11 items-center gap-3 transition-colors duration-fast ease-ui hover:text-text-secondary"
                  >
                    <Phone size={18} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
                    {/* Numbers read left to right in both languages. */}
                    <span dir="ltr">{display}</span>
                  </a>
                )}
                {address && (
                  <p className="flex items-start gap-3">
                    <MapPin
                      size={18}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="mt-1 shrink-0"
                    />
                    <span>{address}</span>
                  </p>
                )}
              </address>
            </div>
          )}
        </div>

        <div className="mt-20 border-t border-brand pt-6 lg:mt-28">
          <p className="type-caption text-text-secondary">{t('footer.rights', { year })}</p>
        </div>
      </Container>
    </footer>
  );
}
