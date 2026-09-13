'use client';

import { useRef, useSyncExternalStore, type ReactNode } from 'react';
import { LazyMotion, m, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { cn } from '@/lib/utils/cn';

export interface ParallaxProps {
  /** Vertical travel as a fraction of the frame height, split evenly either side of centre. */
  travel?: number;
  className?: string;
  /** An image wrapper; the inner element is positioned, so `<Image fill>` works directly. */
  children: ReactNode;
}

const loadFeatures = () => import('./parallax-features').then((mod) => mod.default);

// `false` on the server and during hydration, `true` afterwards — the canonical
// hydration flag, without a setState-in-effect.
const subscribeNever = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

/**
 * Image parallax, idea (3) of the four homepage motion ideas — guideline §13
 * "~4–8% visual travel". `useScroll` with the `cover` preset offset rides a native
 * ScrollTimeline where supported (JS fallback elsewhere); the output is a single
 * `transform` string, which is what lets it accelerate. The image is over-scaled
 * by the travel so the frame edge is never exposed.
 *
 * Hydration safety: the same element renders in every state. The server and the
 * first client render both use the full range; reduced motion collapses the range
 * to zero only after mount, so the `style` attribute never mismatches.
 */
export function Parallax({ travel = 0.06, className, children }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const hydrated = useHydrated();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const collapse = hydrated && reducedMotion === true;
  const travelPct = collapse ? 0 : travel * 100;
  const scale = collapse ? 1 : 1 + travel * 2;
  const transform = useTransform(
    scrollYProgress,
    [0, 1],
    [`translateY(${-travelPct}%) scale(${scale})`, `translateY(${travelPct}%) scale(${scale})`]
  );

  return (
    <div ref={ref} className={cn('overflow-hidden', className)}>
      <LazyMotion features={loadFeatures} strict>
        <m.div style={{ transform }} className="relative h-full w-full will-change-transform">
          {children}
        </m.div>
      </LazyMotion>
    </div>
  );
}
