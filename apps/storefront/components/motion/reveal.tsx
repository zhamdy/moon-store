'use client';

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { decideInitialRevealState } from './reveal-policy';

type RevealElement = 'div' | 'section' | 'header' | 'figure' | 'li' | 'p' | 'h2' | 'h3' | 'span';

export interface RevealProps {
  as?: RevealElement;
  /** `fade-up` (opacity + 24px rise) or `mask` (a line wipe for display type). */
  effect?: 'fade-up' | 'mask';
  /** Stagger step index; each step adds 80ms of delay. */
  delay?: number;
  id?: string;
  className?: string;
  children: ReactNode;
}

const STEP_MS = 80;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Scroll reveal, idea (2) of the four homepage motion ideas. Renders children
 * visible on the server and for no-JS users: React never renders `data-reveal`.
 * On mount, `decideInitialRevealState` holds back only elements entirely below
 * the fold (never under reduced motion) by writing the attribute imperatively;
 * an `IntersectionObserver` flips them to `in` once. The transition itself is CSS
 * driven by the attribute (see `[data-reveal]` in app/globals.css).
 *
 * Deliberately free of the motion runtime: `motion/react`'s named exports do not
 * tree-shake apart, so importing `useInView` here pulled the whole engine into
 * the eager bundle for ~20 instances. `Parallax` is the only motion consumer.
 * A client leaf: takes children only, never the message catalogue.
 */
export function Reveal({
  as = 'div',
  effect = 'fade-up',
  delay = 0,
  id,
  className,
  children,
}: RevealProps) {
  const Component = as;
  const ref = useRef<HTMLElement>(null);

  // Layout effect so a below-fold element is marked pending before the first
  // client paint — an effect after paint would flash it visible then hide it.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.dataset.reveal !== 'in') {
      element.dataset.reveal = decideInitialRevealState(
        element.getBoundingClientRect(),
        window.innerHeight,
        window.matchMedia(REDUCED_MOTION_QUERY).matches
      );
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || element.dataset.reveal === 'in') {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.dataset.reveal = 'in';
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const style =
    delay > 0 ? ({ '--reveal-delay': `${delay * STEP_MS}ms` } as CSSProperties) : undefined;

  return (
    <Component
      // The union of element tags is narrower than the ref type React infers here.
      ref={ref as never}
      id={id}
      className={className}
      data-reveal-effect={effect === 'mask' ? 'mask' : undefined}
      style={style}
    >
      {children}
    </Component>
  );
}
