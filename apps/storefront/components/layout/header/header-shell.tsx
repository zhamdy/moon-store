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
 * On a page with a hero, the header turns solid as soon as the page scrolls at
 * all, and is transparent over the hero only at the very top (user decision,
 * 2026-09-13; it used to stay transparent until the hero left the header band).
 * One passive scroll listener, writing the attribute only when the value changes.
 *
 * The shell lives in the locale layout and survives client-side navigation while
 * the page is swapped underneath it, so it re-checks for a boundary on every
 * pathname change and resets to `auto` first — otherwise a 404 → home transition
 * would keep whatever surface the last page ended on. A client leaf: takes
 * children only, never the message catalogue.
 */
export function HeaderShell({ className, children }: HeaderShellProps) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const header = ref.current;
    if (!header) {
      return;
    }

    header.dataset.surface = 'auto';
    delete header.dataset.surfaceReady;

    if (!document.querySelector(`[${HEADER_BOUNDARY_ATTR}]`)) {
      return;
    }

    const update = () => {
      const next = window.scrollY > 0 ? 'solid' : 'auto';
      if (header.dataset.surface !== next) {
        header.dataset.surface = next;
      }
    };

    // The first write happens before transitions are enabled, so a page restored
    // mid-scroll starts solid with a cut, never an animation from transparent.
    update();
    const readyFrame = requestAnimationFrame(() => {
      header.dataset.surfaceReady = '';
    });
    window.addEventListener('scroll', update, { passive: true });

    return () => {
      window.removeEventListener('scroll', update);
      cancelAnimationFrame(readyFrame);
    };
  }, [pathname]);

  return (
    <header ref={ref} data-surface="auto" className={className}>
      {children}
    </header>
  );
}
