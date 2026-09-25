'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { useLocale } from 'next-intl';
import { getDirection } from '@/i18n/routing';
import { railEdges, railStep, snapTarget, type RailEdges } from './rail-scroll';

export interface ProductRailProps {
  /** The section's server-rendered masthead: title, rule and lead line. */
  heading: ReactNode;
  /** The server-rendered "View all" link beside the navigation controls. */
  viewAll: ReactNode;
  /** Resolved control labels; this island renders no message of its own. */
  labels: { previous: string; next: string };
  /**
   * How many cards `children` holds. Drives `--rail-count`, which caps the
   * visible-card step so a short set fills the column instead of leaving a stub
   * of empty track (see `[data-rail]` in app/globals.css).
   */
  count: number;
  /** The server-rendered cards, already wrapped in their own `<li>`. */
  children: ReactNode;
}

/** Enough pointer travel to mean a drag rather than a click on a card. */
const DRAG_THRESHOLD_PX = 6;

/**
 * Read per call, so turning the setting on mid-session takes effect at once. The
 * global `scroll-behavior: auto !important` under reduced motion does not reach a
 * JS `behavior: 'smooth'`, so every programmatic scroll here asks for itself.
 */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * The pre-measurement state, and the server HTML: a rail sitting at its start with
 * more to come. Rendering the controls and the track from the first paint rather
 * than on hydration is what keeps the row from growing under the reader; the
 * progress fill alone waits, since `thumb: 0` draws nothing.
 */
const AT_REST: RailEdges = {
  scrollable: true,
  atStart: true,
  atEnd: false,
  progress: 0,
  thumb: 0,
};

/**
 * The New Arrivals carousel. A client leaf over a CSS scroll-snap rail
 * (`[data-rail]` in app/globals.css), the same tooling the category and lookbook
 * rails use: the scrolling, the snapping, touch swipe, the reading direction and
 * the cards' own keyboard order are the browser's, and this island only adds what
 * CSS cannot express — the two controls, their disabled edges, the progress rule
 * and a mouse drag.
 *
 * It renders no product and resolves no message: the cards and the heading arrive
 * server-rendered as `ReactNode`s and the two control labels arrive as strings,
 * the `HeroCarousel` contract. Before hydration the server HTML is the rail at
 * rest: the controls are there and `Previous` is already disabled, and only the
 * progress fill waits for a measurement (see `AT_REST`).
 *
 * **It never autoplays** (brief, 2026-09-20). Browsing products stays entirely
 * user-driven, so there is no rotation to pause and no WCAG 2.2.2 mechanism to
 * provide — the one carousel on this site that moves on its own is the hero.
 *
 * Direction: `railStep` re-signs the travel for RTL, where the end of a scroller
 * is a negative `scrollLeft`; everything else works on the absolute distance. The
 * chevrons mirror (`IconButton directional`) so "previous" always points back along the reading
 * direction.
 *
 * Mouse drag: mandatory snapping fights a dragged `scrollLeft` frame by frame, so
 * the drag turns snapping off (`data-dragging`) and `snapTarget` puts the rail
 * back on a card boundary when the pointer lifts. A drag past
 * `DRAG_THRESHOLD_PX` swallows the click it would otherwise end in, so dragging
 * across a card never opens it. Touch is untouched: the browser's own panning is
 * better than anything re-implemented here.
 */
export function ProductRail({ heading, viewAll, labels, count, children }: ProductRailProps) {
  const rtl = getDirection(useLocale()) === 'rtl';
  const railId = useId();
  const railRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState<RailEdges>(AT_REST);

  // Pointer-drag bookkeeping; none of it belongs in render.
  const drag = useRef<{ pointerId: number; startX: number; startScroll: number } | null>(null);
  const dragged = useRef(false);
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (rail) {
      setEdges(railEdges(rail));
    }
  }, []);

  useEffect(() => {
    measure();
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === 'undefined') {
      return;
    }
    // The visible card count changes at 768 and 1024, and so do both edges.
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(
    () => () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
    },
    []
  );

  // One measurement per frame: a scroll fires far more often than it paints.
  const onScroll = () => {
    if (frame.current !== null) {
      return;
    }
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      measure();
    });
  };

  const go = (direction: 1 | -1) => {
    const rail = railRef.current;
    rail?.scrollBy({
      left: railStep(rail.clientWidth, direction, rtl),
      behavior: scrollBehavior(),
    });
  };

  /** Measure the repeating card pitch, including the gap, for drag snapping. */
  const itemPitch = (rail: HTMLUListElement): number => {
    const items = rail.children;
    const last = items[items.length - 1];
    const previous = items[items.length - 2];
    if (last instanceof HTMLElement && previous instanceof HTMLElement) {
      return Math.abs(last.offsetLeft - previous.offsetLeft);
    }
    return last instanceof HTMLElement ? last.offsetWidth : 0;
  };

  const onPointerDown = (event: PointerEvent<HTMLUListElement>) => {
    const rail = railRef.current;
    if (!rail || event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: rail.scrollLeft,
    };
    dragged.current = false;
  };

  const onPointerMove = (event: PointerEvent<HTMLUListElement>) => {
    const rail = railRef.current;
    const state = drag.current;
    if (!rail || !state || state.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - state.startX;
    if (!dragged.current) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) {
        return;
      }
      dragged.current = true;
      rail.dataset.dragging = '';
      rail.setPointerCapture(state.pointerId);
    }
    // Physical, not logical: the surface follows the pointer in either direction.
    rail.scrollLeft = state.startScroll - dx;
  };

  const endDrag = (event: PointerEvent<HTMLUListElement>) => {
    const rail = railRef.current;
    const state = drag.current;
    drag.current = null;
    if (!rail || !state || state.pointerId !== event.pointerId || !dragged.current) {
      return;
    }
    delete rail.dataset.dragging;
    if (rail.hasPointerCapture(state.pointerId)) {
      rail.releasePointerCapture(state.pointerId);
    }
    const max = Math.max(rail.scrollWidth - rail.clientWidth, 0);
    const target = snapTarget(Math.abs(rail.scrollLeft), itemPitch(rail), max);
    rail.scrollTo({ left: rtl ? -target : target, behavior: scrollBehavior() });
  };

  // The design system's rail control (`IconButton variant="outline"`, homepage Phase 2);
  // `directional` mirrors the chevron under RTL so "previous" points back along the
  // reading direction.
  const controls = edges.scrollable && (
    <div className="flex items-center gap-2">
      <IconButton
        variant="outline"
        directional
        aria-label={labels.previous}
        aria-controls={railId}
        disabled={edges.atStart}
        onClick={() => go(-1)}
      >
        <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
      </IconButton>
      <IconButton
        variant="outline"
        directional
        aria-label={labels.next}
        aria-controls={railId}
        disabled={edges.atEnd}
        onClick={() => go(1)}
      >
        <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
      </IconButton>
    </div>
  );

  /* How much of the row is in view and where it sits — the swipe affordance on a
     phone, where the controls are the least likely thing to be used. Hidden from
     assistive tech: the same fact is already in the controls' states. */
  const progress = edges.scrollable && (
    <div
      aria-hidden="true"
      data-rail-progress=""
      style={
        {
          '--rail-thumb': String(edges.thumb),
          '--rail-progress': String(edges.progress),
        } as CSSProperties
      }
    >
      <span />
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b border-border pb-6 md:pb-8">
        {heading}
        <div className="flex items-center gap-6 md:gap-8">
          {viewAll}
          {controls}
        </div>
      </div>

      <div className="min-w-0">
        <ul
          ref={railRef}
          id={railId}
          role="list"
          data-rail=""
          className="mt-6 md:mt-8"
          style={{ '--rail-count': count } as CSSProperties}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          // A dragged card is a drag, not a visit; the native image drag would
          // otherwise hijack the gesture halfway through.
          onDragStart={(event) => event.preventDefault()}
          onClickCapture={(event) => {
            if (dragged.current) {
              event.preventDefault();
              event.stopPropagation();
              dragged.current = false;
            }
          }}
        >
          {children}
        </ul>

        {/* Progress stays beside the browsing surface at every width. */}
        {progress && <div className="mt-8">{progress}</div>}
      </div>
    </div>
  );
}
