import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A word printed on a photograph or beside a name: New, Sold out, a limited-stock
 * note. Words first, colour second — the dot only reinforces the word.
 *
 * - `new`: Ink word, Gold dot (the one jewellery accent a card carries).
 * - `soldOut`: the danger word and dot.
 * - `notice`: Bronze-deep word (limited stock, price updated).
 *
 * `onImage` sets it on a translucent Ivory plate so it holds over any photograph.
 * One badge per card at most; sold out wins over new.
 */
export function Badge({
  tone = 'new',
  onImage = false,
  className,
  children,
}: {
  tone?: 'new' | 'soldOut' | 'notice';
  onImage?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-control type-caption font-semibold uppercase tracking-[0.14em] rtl:tracking-normal',
        onImage && 'bg-ivory/95 px-2.5 py-1',
        tone === 'new' && 'text-ink',
        tone === 'soldOut' && 'text-danger',
        tone === 'notice' && 'text-notice',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 shrink-0 rounded-pill',
          tone === 'new' && 'bg-metallic',
          tone === 'soldOut' && 'bg-danger',
          tone === 'notice' && 'bg-brand'
        )}
      />
      {children}
    </span>
  );
}
