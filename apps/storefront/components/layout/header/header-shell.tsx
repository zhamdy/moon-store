'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { HEADER_BOUNDARY_ATTR } from './header-boundary';

export interface HeaderShellProps {
  className?: string;
  children: ReactNode;
}

/**
 * Owns `data-surface` on the `<header>`. The server always renders `auto`, which
 * CSS resolves: overlay when the page has a hero carrying `HEADER_BOUNDARY_ATTR`
 * (a `body:has()` rule in app/globals.css), solid otherwise — so first paint is
 * right with no JS and there is never an ivory→transparent flip on load.
 *
 * This island only narrows that: it observes the hero region with a top
 * `rootMargin` equal to the header height, so "intersecting" means "some of the
 * hero is still under the header band". When it stops intersecting, the header
 * becomes `solid`; when it returns, `auto`. `--header-h` is read from computed
 * style so the observer and the CSS token cannot drift. A client leaf: takes
 * children only, never the message catalogue.
 */
export function HeaderShell({ className, children }: HeaderShellProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    const boundary = document.querySelector(`[${HEADER_BOUNDARY_ATTR}]`);
    if (!header || !boundary) {
      return;
    }

    let observer: IntersectionObserver | undefined;

    const observe = () => {
      observer?.disconnect();
      const headerHeight =
        parseFloat(getComputedStyle(header).getPropertyValue('--header-h')) || header.offsetHeight;
      observer = new IntersectionObserver(
        ([entry]) => {
          header.dataset.surface = entry.isIntersecting ? 'auto' : 'solid';
          // Transitions are enabled only after the first observation, so the
          // initial state is a cut, never an animation from the wrong surface.
          header.dataset.surfaceReady = '';
        },
        { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0 }
      );
      observer.observe(boundary);
    };

    // The header height changes at the desktop breakpoint; a stale rootMargin
    // would flip the surface a few pixels early or late.
    const desktop = window.matchMedia('(min-width: 1024px)');
    observe();
    desktop.addEventListener('change', observe);

    return () => {
      desktop.removeEventListener('change', observe);
      observer?.disconnect();
    };
  }, []);

  return (
    <header ref={ref} data-surface="auto" className={className}>
      {children}
    </header>
  );
}
