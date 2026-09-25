import type { Messages } from 'next-intl';
import type { EditorialSlot } from '@/lib/editorial/slots';

export type LookbookAltKey = Exclude<
  keyof Messages['home']['lookbook'],
  'heading' | 'eyebrow' | 'lead'
>;

export interface LookbookItem {
  slot: EditorialSlot;
  altKey: LookbookAltKey;
  /** Frame ratio as a Tailwind aspect utility; varied on purpose (guideline §12·10 mosaic). */
  aspect: 'aspect-4/5' | 'aspect-square' | 'aspect-3/4';
}

export const lookbookItems: readonly LookbookItem[] = [
  { slot: 'lookbook-01', altKey: 'alt1', aspect: 'aspect-4/5' },
  { slot: 'lookbook-02', altKey: 'alt2', aspect: 'aspect-square' },
  { slot: 'lookbook-03', altKey: 'alt3', aspect: 'aspect-3/4' },
  { slot: 'lookbook-04', altKey: 'alt4', aspect: 'aspect-4/5' },
  { slot: 'lookbook-05', altKey: 'alt5', aspect: 'aspect-square' },
];
