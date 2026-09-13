import type { Messages } from 'next-intl';
import type { EditorialSlot } from '@/lib/editorial/slots';

export interface HomeCategory {
  key: string;
  /** Intended destination; 404s today (no placeholder pages — Scope Boundaries). */
  href: string;
  image: EditorialSlot;
  messageKey: keyof Messages['categories'];
}
