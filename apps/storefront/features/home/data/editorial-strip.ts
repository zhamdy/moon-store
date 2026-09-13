import type { Messages } from 'next-intl';
import type { EditorialSlot } from '@/lib/editorial/slots';

export type StripItem =
  | { kind: 'word'; messageKey: keyof Messages['home']['strip']['words'] }
  | { kind: 'image'; slot: EditorialSlot };

/** Oversized collection words alternating with small 3:4 details, one loop. */
export const editorialStripItems: readonly StripItem[] = [
  { kind: 'word', messageKey: 'evening' },
  { kind: 'image', slot: 'strip-01' },
  { kind: 'word', messageKey: 'linen' },
  { kind: 'image', slot: 'strip-02' },
  { kind: 'word', messageKey: 'knit' },
  { kind: 'image', slot: 'strip-03' },
  { kind: 'word', messageKey: 'abaya' },
  { kind: 'image', slot: 'strip-04' },
];
