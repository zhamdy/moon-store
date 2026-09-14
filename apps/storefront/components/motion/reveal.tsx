'use client';

import { useEffect, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { decideInitialRevealState } from './reveal-policy';

type RevealElement = 'div' | 'section' | 'header' | 'figure' | 'ul' | 'li' | 'article';

/** What a `data-motion` element does while its Reveal is pending (see app/globals.css). */
export type MotionEffect = 'rise' | 'fade' | 'image';

export interface RevealProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  as?: RevealElement;
  /**
   * Animate the element itself. Omit for a pure trigger whose server-rendered
   * descendants carry their own `data-motion`.
   */
  effect?: MotionEffect;
  /**
   * How far up the viewport, as a fraction of its height from the bottom, the
   * element's top must travel before it plays. A margin, not an intersection
   * ratio, so an element taller than the viewport still triggers.
   */
  amount?: number;
  children: ReactNode;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** One observer per margin for the whole page, however many Reveals mount. */
const observers = new Map<string, IntersectionObserver>();

function observeOnce(element: HTMLElement, rootMargin: string): () => void {
  let observer = observers.get(rootMargin);
  if (!observer) {
    observer = new IntersectionObserver(
      (entries, self) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.reveal = 'in';
            self.unobserve(entry.target);
          }
        }
      },
      { rootMargin }
    );
    observers.set(rootMargin, observer);
  }
  const active = observer;
  active.observe(element);
  return () => active.unobserve(element);
}

/**
 * Scroll reveal trigger. Renders children visible on the server and for no-JS
 * users: React never renders `data-reveal`. On mount, `decideInitialRevealState`
 * holds back only elements entirely below the fold (never under reduced motion)
 * by writing the attribute imperatively; a shared `IntersectionObserver` flips
 * them to `in` once.
 *
 * The choreography is not here. It is declared on the server with `data-motion`
 * attributes on this element or its descendants, and played by CSS keyed on this
 * element's state ("Scroll reveal" in app/globals.css). So one small client leaf
 * sequences an image, a masked headline and a delayed link inside a Server
 * Component, with no per-item JS.
 *
 * Deliberately free of the motion runtime: `motion/react`'s named exports do not
 * tree-shake apart. Nested Reveals are safe: an outer one always triggers first,
 * because its top is never below an inner one's and both use the same margin.
 */
export function Reveal({
  as: Component = 'div',
  effect,
  amount = 0.15,
  children,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  // Layout effect so a below-fold element is marked pending before the first
  // client paint; an effect after paint would flash it visible then hide it.
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
    return observeOnce(element, `0px 0px -${Math.round(amount * 100)}% 0px`);
  }, [amount]);

  return (
    // The union of element tags is narrower than the ref type React infers here.
    <Component {...props} ref={ref as never} data-motion={effect}>
      {children}
    </Component>
  );
}
