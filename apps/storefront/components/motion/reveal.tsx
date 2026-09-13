'use client';

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
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

/**
 * Scroll reveal, idea (2) of the four homepage motion ideas. Renders children
 * visible on the server and for no-JS users: React never renders `data-reveal`.
 * On mount, `decideInitialRevealState` holds back only elements entirely below
 * the fold (never under reduced motion) by writing the attribute imperatively;
 * `useInView` flips them to `in` once. The transition itself is CSS driven by the
 * attribute (see `[data-reveal]` in app/globals.css).
 *
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
  const reducedMotion = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.2, margin: '0px 0px -8% 0px' });

  // Layout effect so a below-fold element is marked pending before the first
  // client paint — an effect after paint would flash it visible then hide it.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.dataset.reveal !== 'in') {
      element.dataset.reveal = decideInitialRevealState(
        element.getBoundingClientRect(),
        window.innerHeight,
        reducedMotion
      );
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (inView && ref.current) {
      ref.current.dataset.reveal = 'in';
    }
  }, [inView]);

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
