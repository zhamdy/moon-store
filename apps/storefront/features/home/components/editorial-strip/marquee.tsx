import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface MarqueeProps {
  /**
   * How many times the content repeats inside one track. A track must be wider
   * than the widest viewport, or the loop shows an empty stretch before it
   * restarts; one set of the editorial strip is ~1,400–1,800px, so 3 covers
   * ~4,000px+ screens. Speed stays constant: duration scales with this.
   */
  repeat?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Editorial marquee, idea (4) of the four homepage motion ideas — pure CSS, a
 * Server Component. Two identical tracks sit side by side; each animates left by
 * exactly its own width plus the gap, which lands the second track where the
 * first began, so the loop is seamless. Tracks are sized by their content, never
 * stretched — a stretched track puts its empty space at the seam, which reads as
 * one gap much wider than the rest.
 *
 * Only the first set in the first track is exposed to assistive tech; every other
 * copy is `aria-hidden`. Pauses on hover and focus-within, travels the other way
 * under `[dir="rtl"]`, and under reduced motion every copy is removed and the
 * single set scrolls naturally — see `.marquee` in app/globals.css. Lives in the
 * home slice as the editorial strip's only consumer.
 */
export function Marquee({ repeat = 3, className, children }: MarqueeProps) {
  const copies = Math.max(1, Math.floor(repeat));
  const extraCopies = Array.from({ length: copies - 1 }, (_, index) => (
    <div key={index} className="contents" aria-hidden="true" data-marquee-copy="">
      {children}
    </div>
  ));

  return (
    <div
      className={cn('marquee', className)}
      style={{ '--marquee-repeat': copies } as CSSProperties}
    >
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
