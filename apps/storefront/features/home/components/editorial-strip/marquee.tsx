import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface MarqueeProps {
  /**
   * How many times the content repeats inside one track. A track must be wider
   * than the widest viewport, or the loop shows an empty stretch before it
   * restarts. Speed stays constant: duration scales with this.
   */
  repeat?: number;
  /** Seconds for one set of the content to cross: the loop's speed. */
  duration?: number;
  /** Space between items and between sets, any CSS length. */
  gap?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Editorial marquee, pure CSS, a Server Component. Two identical tracks sit side
 * by side; each animates by exactly its own width plus the gap, which lands the
 * second track where the first began, so the loop is seamless. Tracks are sized
 * by their content, never stretched: a stretched track puts its empty space at
 * the seam, which reads as one gap much wider than the rest.
 *
 * Only the first set in the first track is exposed to assistive tech; every other
 * copy is `aria-hidden`. Pauses on hover, on focus-within (nothing inside this
 * component is itself focusable — that rule catches focus moving through
 * `aria-hidden` copies in some browsers). The visible Pause control belongs to the
 * caller (`EditorialStrip`'s CSS-only toggle, homepage Phase 2).
 * Travels the other way under `[dir="rtl"]`, and under reduced
 * motion every copy is removed and the single set scrolls naturally. See
 * `.marquee` in app/globals.css.
 */
export function Marquee({ repeat = 3, duration = 48, gap, className, children }: MarqueeProps) {
  const copies = Math.max(1, Math.floor(repeat));
  const extraCopies = Array.from({ length: copies - 1 }, (_, index) => (
    <div key={index} className="contents" aria-hidden="true" data-marquee-copy="">
      {children}
    </div>
  ));
  const style = {
    '--marquee-repeat': copies,
    '--marquee-set': `${duration}s`,
    ...(gap ? { '--marquee-gap': gap } : {}),
  } as CSSProperties;

  return (
    <div className={cn('marquee', className)} style={style}>
      <div className="marquee-track">
        {children}
        {extraCopies}
      </div>
      <div className="marquee-track" aria-hidden="true">
        {children}
        {extraCopies}
      </div>
    </div>
  );
}
