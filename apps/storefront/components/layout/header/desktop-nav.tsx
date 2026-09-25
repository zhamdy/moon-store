'use client';

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { navPanelAfterKey, type NavPanelKey } from './desktop-nav-state';

export interface DesktopNavItem {
  key: string;
  label: string;
  href: string;
  /**
   * Server-rendered panel content. With one, the item is a disclosure button that opens
   * it; without one (New In, or Collections when the catalogue cannot answer) it is a
   * plain link to `href`.
   */
  panel?: ReactNode;
}

export interface DesktopNavProps {
  items: DesktopNavItem[];
  /** `navigation.primaryLabel`, resolved on the server. */
  label: string;
}

/** Hover intent: long enough that sweeping across the bar does not flash a panel. */
const OPEN_DELAY_MS = 90;
/** Long enough to cross the gap between a trigger and its panel without it closing. */
const CLOSE_DELAY_MS = 220;

/**
 * The desktop primary navigation (header direction B, 2026-09-26; the twenty-first client
 * boundary). Shop and Collections are **disclosure buttons** (the WAI-ARIA disclosure
 * navigation pattern, not a `menu`): each controls a full-width panel under the bar whose
 * content arrives server-rendered as a `ReactNode`, so this island renders no link list
 * of its own and resolves no message. New In is a plain link.
 *
 * Opens on click, Enter or Space, and on hover with a mouse after `OPEN_DELAY_MS`; closes
 * on a second click, Escape (focus returns to the trigger), a pointer-down outside,
 * focus leaving the nav and its panel, the pointer leaving both for `CLOSE_DELAY_MS`, a
 * click on any link inside the panel, and a route change. One panel at a time. The pure
 * transitions are `desktop-nav-state.ts`, unit-tested.
 *
 * While a panel is open the root carries `data-nav-open`, which the header's surface rule
 * reads (`app/globals.css` → *Surfaces*) to turn the header solid over a hero, and a
 * backdrop dims the page under the header; clicking it closes the panel. The panels are
 * positioned against the sticky `<header>` (this island adds no positioned wrapper), so
 * they run the header's full width under the bar. Panels stay in the DOM while closed
 * (`hidden`), so their links are in the server HTML.
 */
export function DesktopNav({ items, label }: DesktopNavProps) {
  const [open, setOpen] = useState<NavPanelKey>(null);
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** How the open panel was opened: a click on a hover-opened trigger keeps it open. */
  const openedByHover = useRef(false);
  const pathname = usePathname();

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const schedule = (next: NavPanelKey, delay: number) => {
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      openedByHover.current = next !== null;
      setOpen(next);
    }, delay);
  };

  // A route change closes the panel (the island survives client navigation).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(null);
  }

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (open === null) {
      return;
    }
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open !== null) {
      event.preventDefault();
      const trigger = triggers.current.get(open);
      setOpen(null);
      trigger?.focus();
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(null);
    }
  };

  const onPanelClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('a')) {
      setOpen(null);
    }
  };

  const mouse = (event: PointerEvent) => event.pointerType === 'mouse';

  return (
    <div
      ref={rootRef}
      data-nav-open={open !== null ? '' : undefined}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onPointerLeave={(event) => mouse(event) && open !== null && schedule(null, CLOSE_DELAY_MS)}
      onPointerEnter={(event) => mouse(event) && open !== null && clearTimer()}
      className="contents"
    >
      <nav aria-label={label} className="flex items-center gap-8">
        {items.map((item) => {
          const panelId = `${baseId}-${item.key}`;
          if (!item.panel) {
            return (
              <Link
                key={item.key}
                href={item.href}
                onPointerEnter={(event) =>
                  mouse(event) && open !== null && schedule(null, OPEN_DELAY_MS)
                }
                className="type-ui inline-flex min-h-(--size-tap) items-center text-text transition-colors duration-fast ease-ui hover:text-brand"
              >
                {item.label}
              </Link>
            );
          }
          const expanded = open === item.key;
          return (
            <Fragment key={item.key}>
              <button
                ref={(element) => {
                  if (element) triggers.current.set(item.key, element);
                  else triggers.current.delete(item.key);
                }}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => {
                  clearTimer();
                  // A pointer that hovered the panel open and then clicks means "keep it".
                  if (open === item.key && openedByHover.current) {
                    openedByHover.current = false;
                    return;
                  }
                  openedByHover.current = false;
                  setOpen((current) => navPanelAfterKey(current, item.key));
                }}
                onPointerEnter={(event) => mouse(event) && schedule(item.key, OPEN_DELAY_MS)}
                onPointerLeave={(event) => mouse(event) && open === null && clearTimer()}
                className={cn(
                  'type-ui group inline-flex min-h-(--size-tap) cursor-pointer items-center gap-1.5 text-text',
                  'bg-no-repeat bg-[position:0_calc(100%-10px)] rtl:bg-[position:100%_calc(100%-10px)]',
                  '[background-image:linear-gradient(currentColor,currentColor)]',
                  'transition-[background-size,color] duration-fast ease-ui hover:text-brand',
                  expanded ? 'bg-[length:100%_1px]' : 'bg-[length:0%_1px]'
                )}
              >
                {item.label}
                <ChevronDown
                  aria-hidden="true"
                  size={14}
                  strokeWidth={1.5}
                  className={cn(
                    'transition-transform duration-fast ease-ui',
                    expanded && 'rotate-180'
                  )}
                />
              </button>
              {/* Right after its trigger, so Tab moves into it; positioned against the
                sticky header, so it runs the header's full width under the bar. */}
              <div
                id={panelId}
                hidden={!expanded}
                data-nav-panel=""
                onClick={onPanelClick}
                onPointerEnter={(event) => mouse(event) && clearTimer()}
                className="absolute inset-x-0 top-full z-10 border-t border-border bg-bg text-text shadow-(--shadow-overlay)"
              >
                {item.panel}
              </div>
            </Fragment>
          );
        })}
      </nav>

      {open !== null && (
        <div
          aria-hidden="true"
          data-nav-backdrop=""
          onClick={() => setOpen(null)}
          onPointerEnter={(event) => mouse(event) && schedule(null, CLOSE_DELAY_MS)}
          className="fixed inset-x-0 top-(--header-h) bottom-0 -z-10 bg-overlay/45"
        />
      )}
    </div>
  );
}
