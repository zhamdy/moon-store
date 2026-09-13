import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface MarqueeProps {
  className?: string;
  children: ReactNode;
}

/**
 * Editorial marquee, idea (4) of the four homepage motion ideas — pure CSS, a
 * Server Component. The track renders twice for a seamless loop; the second copy
 * is `aria-hidden` so assistive tech reads the content once. Pauses on hover and
 * focus-within, travels the other way under `[dir="rtl"]`, and under reduced
 * motion the copy is removed and the single track scrolls naturally — see
 * `.marquee` in app/globals.css. Duration is set there too: one consumer, one
 * speed. Lives in the home slice as the editorial strip's only consumer.
 */
export function Marquee({ className, children }: MarqueeProps) {
  return (
    <div className={cn('marquee', className)}>
      <div className="marquee-track">{children}</div>
      <div className="marquee-track" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}
