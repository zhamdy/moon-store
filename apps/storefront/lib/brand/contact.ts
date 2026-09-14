import type { AppLocale } from '@/i18n/routing';

export type SocialNetwork = 'instagram' | 'facebook' | 'whatsapp' | 'x' | 'youtube';

export interface SocialLink {
  network: SocialNetwork;
  /** Full https URL of the Moon Fashion profile (for WhatsApp, a https://wa.me/... link). */
  url: string;
}

export interface StoreContact {
  phone: {
    /** International format with country code and no spaces, e.g. `+20XXXXXXXXXX`. */
    e164: string;
    /** How the number is printed, e.g. `+20 10 XXXX XXXX`. Western digits in both locales. */
    display: string;
  };
  /** The public store address in each locale. Both empty hides it. */
  address: Record<AppLocale, string>;
  social: readonly SocialLink[];
}

/**
 * Moon Fashion's public contact details, shown in the storefront footer.
 *
 * This is business data, not translation, so it lives here rather than in the
 * message catalogues. **Fill in only real, confirmed values.** Every field is
 * optional: the footer renders exactly what is filled in and nothing else, so an
 * empty phone, address or social list simply does not appear.
 *
 * Never copy the server seed's `phone` / `address` settings here: they are demo
 * values (`apps/server/src/database/seed.ts`), not the business's details.
 */
export const storeContact: StoreContact = {
  phone: { e164: '', display: '' },
  address: { en: '', ar: '' },
  social: [],
};

/** A `tel:` href from any printed or E.164 number: keeps the leading `+` and digits only. */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

/** Whether the footer has any contact line to show for this locale. */
export function hasContactDetails(contact: StoreContact, locale: AppLocale): boolean {
  return contact.phone.e164.trim() !== '' || contact.address[locale].trim() !== '';
}

/** Problems with a contact config, as readable messages; empty when it is valid. */
export function validateStoreContact(contact: StoreContact): string[] {
  const problems: string[] = [];
  const { e164, display } = contact.phone;
  if (e164 !== '' && !/^\+\d{8,15}$/.test(e164)) {
    problems.push(`phone.e164 "${e164}" is not in international format (+ and 8–15 digits)`);
  }
  if ((e164 === '') !== (display === '')) {
    problems.push('phone.e164 and phone.display must be filled in together');
  }
  if ((contact.address.en === '') !== (contact.address.ar === '')) {
    problems.push('address must be filled in for both en and ar, or neither');
  }
  const seen = new Set<SocialNetwork>();
  for (const link of contact.social) {
    if (!/^https:\/\/\S+$/.test(link.url)) {
      problems.push(`${link.network} url "${link.url}" must be a full https URL`);
    }
    if (seen.has(link.network)) {
      problems.push(`${link.network} is listed more than once`);
    }
    seen.add(link.network);
  }
  return problems;
}
