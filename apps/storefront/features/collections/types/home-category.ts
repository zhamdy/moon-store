import type { Messages } from 'next-intl';
import type { EditorialSlot } from '@/lib/editorial/slots';

export interface HomeCategory {
  key: string;
  /** `/shop/<key>`, a `REQUIRED_CATALOG_KEYS` category (`commerce-hrefs.test.ts`). */
  href: string;
  image: EditorialSlot;
  messageKey: keyof Messages['categories'];
}
