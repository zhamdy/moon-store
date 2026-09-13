'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';
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
 * style so the observer and the CSS token cannot drift.
 *
 * The shell lives in the locale layout and survives client-side navigation while
 * the page (and its hero) is swapped underneath it, so the boundary is looked up
 * again on every pathname change; a page with no boundary resets the surface to
 * `auto`, which CSS resolves to solid there. A client leaf: takes children only,
 * never the message catalogue.
 */
export function HeaderShell({ className, children }: HeaderShellProps) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const header = ref.current;
    if (!header) {
      return;
    }

    // Each page starts from the server's state: a cut, never an animation from
    // whatever surface the previous page left behind.
    header.dataset.surface = 'auto';
    delete header.dataset.surfaceReady;

    const boundary = document.querySelector(`[${HEADER_BOUNDARY_ATTR}]`);
    if (!boundary) {
      return;
    }

    let observer: IntersectionObserver | undefined;
    let readyFrame: number | undefined;

    const observe = () => {
      observer?.disconnect();
      const headerHeight =
        parseFloat(getComputedStyle(header).getPropertyValue('--header-h')) || header.offsetHeight;
      observer = new IntersectionObserver(
        ([entry]) => {
          header.dataset.surface = entry.isIntersecting ? 'auto' : 'solid';
          // Transitions are enabled one frame after the first observation: set
          // in the same style change, the transition would apply to that very
          // write and the first state would animate instead of cutting.
          if (!('surfaceReady' in header.dataset) && readyFrame === undefined) {
            readyFrame = requestAnimationFrame(() => {
              header.dataset.surfaceReady = '';
            });
          }
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
      if (readyFrame !== undefined) {
        cancelAnimationFrame(readyFrame);
      }
    };
  }, [pathname]);

  return (
    <header ref={ref} data-surface="auto" className={className}>
      {children}
    </header>
  );
}
