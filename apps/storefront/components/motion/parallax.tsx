'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { scroll } from 'motion';
import { animate } from 'motion/mini';
import { cn } from '@/lib/utils/cn';

export interface ParallaxProps {
  /**
   * Travel as a fraction of the element's height, split evenly either side of its
   * resting place. Positive moves against the scroll (a layer lags, an element
   * leads); negative reverses it. Halved below 768px.
   */
  travel?: number;
  /**
   * `layer` (default): the child moves inside a clipped frame, for a full-bleed
   * image. `element`: the whole element moves through the page, for pieces of a
   * composition that should travel at their own speed.
   */
  mode?: 'layer' | 'element';
  /** Element mode only: a media query the effect needs, e.g. `(min-width: 1024px)`. */
  media?: string;
  className?: string;
  /** In layer mode the inner element is positioned, so `<Image fill>` works directly. */
  children: ReactNode;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const MOBILE_QUERY = '(max-width: 767px)';
const MOBILE_FACTOR = 0.5;

/**
 * Scroll parallax, transform only, never pinned. A paused WAAPI animation from
 * `motion/mini`'s `animate` whose time is set from `scroll()`'s progress callback.
 * This is the ~9 KB gz vanilla path on purpose: the React wrapper pulls the whole
 * engine into the eager bundle because `motion/react`'s named exports do not
 * tree-shake apart.
 *
 * Deliberately the *function* form of `scroll()`, not `scroll(animation)`: in
 * motion 13.2 the animation form takes the JS path for this offset anyway, and
 * that path caches a scroll subscription per target that its cleanup never
 * cancels, leaking a handler on every client-side navigation.
 *
 * Layer mode over-scales the child by the travel so the frame edge is never
 * exposed. That is CSS (`--parallax-scale`, see `[data-parallax]` in
 * app/globals.css), collapsed under reduced motion, so the server HTML, the no-JS
 * state and the reduced-motion state are the same still element. Element mode
 * animates the independent `translate` property, so a `<Reveal>` transform on the
 * same element composes with it instead of being overwritten.
 *
 * Re-evaluates when reduced motion, the phone breakpoint or `media` changes.
 */
export function Parallax({
  travel = 0.06,
  mode = 'layer',
  media,
  className,
  children,
}: ParallaxProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const scale = 1 + Math.abs(travel) * 2;

  useEffect(() => {
    const frame = frameRef.current;
    const layer = layerRef.current;
    if (!frame || !layer) {
      return;
    }
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    const mobile = window.matchMedia(MOBILE_QUERY);
    const required = mode === 'element' && media ? window.matchMedia(media) : null;
    let teardown: (() => void) | null = null;

    const sync = () => {
      teardown?.();
      teardown = null;
      if (reduced.matches || (required && !required.matches)) {
        return;
      }
      const pct = travel * (mobile.matches ? MOBILE_FACTOR : 1) * 100;
      const animation =
        mode === 'layer'
          ? animate(
              layer,
              {
                transform: [
                  `translateY(${-pct}%) scale(${scale})`,
                  `translateY(${pct}%) scale(${scale})`,
                ],
              },
              { ease: 'linear' }
            )
          : animate(frame, { translate: [`0 ${pct}%`, `0 ${-pct}%`] }, { ease: 'linear' });
      animation.pause();
      const detach = scroll(
        (progress: number) => {
          animation.time = animation.iterationDuration * progress;
        },
        { target: frame, offset: ['start end', 'end start'] }
      );
      teardown = () => {
        detach();
        animation.cancel();
      };
    };

    const queries = required ? [reduced, mobile, required] : [reduced, mobile];
    sync();
    for (const query of queries) {
      query.addEventListener('change', sync);
    }
    return () => {
      for (const query of queries) {
        query.removeEventListener('change', sync);
      }
      teardown?.();
    };
  }, [travel, mode, media, scale]);

  return (
    <div
      ref={frameRef}
      data-parallax={mode}
      style={mode === 'layer' ? ({ '--parallax-scale': scale } as CSSProperties) : undefined}
      className={cn(mode === 'layer' && 'overflow-hidden', className)}
    >
      <div ref={layerRef} className="relative h-full w-full">
        {children}
      </div>
    </div>
  );
}
