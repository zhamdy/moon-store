'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { scroll } from 'motion';
import { animate } from 'motion/mini';
import { cn } from '@/lib/utils/cn';

export interface ParallaxProps {
  /** Vertical travel as a fraction of the frame height, split evenly either side of centre. */
  travel?: number;
  className?: string;
  /** An image wrapper; the inner element is positioned, so `<Image fill>` works directly. */
  children: ReactNode;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Image parallax, idea (3) of the four homepage motion ideas — guideline §13
 * "~4–8% visual travel". A paused WAAPI animation from `motion/mini`'s `animate`
 * whose time is set from `scroll()`'s progress callback, `transform` only. This
 * is the ~9 KB gz vanilla path on purpose: the React wrapper (`m`, `LazyMotion`,
 * `useScroll`) pulls the whole engine into the eager bundle because
 * `motion/react`'s named exports do not tree-shake apart.
 *
 * Deliberately the *function* form of `scroll()`, not `scroll(animation)`: in
 * motion 13.2 the animation form only reaches a native ScrollTimeline for the
 * preset offsets in its own reversed order (`['end start', 'start end']`), so
 * this offset takes the JS path anyway — and that path caches a scroll
 * subscription per target that its cleanup never cancels, leaking a handler on
 * every client-side navigation. The function form's cleanup does unsubscribe.
 * Progress is applied by one shared, event-driven scroll listener per container.
 *
 * The image is over-scaled by the travel so the frame edge is never exposed —
 * done in CSS (`--parallax-scale`, see `[data-parallax]` in app/globals.css) and
 * collapsed to none under reduced motion, so the server HTML, the no-JS state
 * and the reduced-motion state are all the same unanimated element. JS only
 * attaches the scroll-driven translate when motion is allowed.
 */
export function Parallax({ travel = 0.06, className, children }: ParallaxProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const layer = layerRef.current;
    if (!frame || !layer || window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      return;
    }
    const pct = travel * 100;
    const scale = 1 + travel * 2;
    const animation = animate(
      layer,
      {
        transform: [`translateY(-${pct}%) scale(${scale})`, `translateY(${pct}%) scale(${scale})`],
      },
      { ease: 'linear' }
    );
    animation.pause();
    const detach = scroll(
      (progress: number) => {
        animation.time = animation.iterationDuration * progress;
      },
      { target: frame, offset: ['start end', 'end start'] }
    );
    return () => {
      detach();
      animation.cancel();
    };
  }, [travel]);

  return (
    <div
      ref={frameRef}
      data-parallax=""
      style={{ '--parallax-scale': 1 + travel * 2 } as CSSProperties}
      className={cn('overflow-hidden', className)}
    >
      <div ref={layerRef} className="relative h-full w-full">
        {children}
      </div>
    </div>
  );
}
