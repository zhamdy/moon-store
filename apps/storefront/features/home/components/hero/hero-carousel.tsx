'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useLocale } from 'next-intl';
import { getDirection } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils/cn';
import {
  carouselState,
  resolveKeyTarget,
  stepFromKey,
  stepFromSwipe,
  wrapIndex,
} from './hero-carousel-state';

export interface HeroCarouselSlide {
  key: string;
  /** Visible tab text, the collection name. */
  tabLabel: string;
  /** The slide's accessible label, e.g. "2 of 4". */
  slideLabel: string;
  /** Server-rendered picture, scrims and copy. */
  content: ReactNode;
}

export interface HeroCarouselProps {
  slides: HeroCarouselSlide[];
  tabListLabel: string;
}

const INTERVAL_MS = 7000;

/** The shown slide and the one leaving it, which plays its exit. */
interface SlideState {
  active: number;
  previous: number | null;
}
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const subscribeNever = () => () => {};
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * The hero's slides, on the WAI-ARIA tabbed carousel pattern: a tablist of
 * collection names, one tabpanel per slide. Inactive slides are `inert` and hidden,
 * so assistive tech and the keyboard only ever meet the visible one.
 *
 * Rotation is driven by the active tab's CSS progress bar: its `animationend`
 * advances the slide, so pausing the animation pauses the timer with no drift.
 * Autoplay never starts before hydration or under reduced motion (read live, so
 * turning the setting on mid-session stops it). There is deliberately no pause
 * button (user decision): hovering pauses rotation until the pointer leaves, and
 * keyboard focus inside the carousel, a tab click, an arrow key or a swipe stops it
 * for the rest of the visit — that interaction is the WCAG 2.2.2 stop mechanism.
 * The live region is `off` while rotating and `polite` once stopped.
 *
 * A client leaf: slide content arrives server-rendered as children, and every
 * string arrives resolved. Transitions and entrances are CSS keyed on
 * `data-active` — see "Hero slides" in app/globals.css.
 *
 * Rotation also pauses whenever the hero scrolls out of view (one
 * `IntersectionObserver` on the root element), the same way hovering does: the
 * progress fill freezes and resumes where it left off, and the slide never
 * changes while away. "Stopped by interaction" stays sticky across leaving and
 * re-entering the viewport — see `carouselState` in `hero-carousel-state.ts`.
 */
export function HeroCarousel({ slides, tabListLabel }: HeroCarouselProps) {
  const rtl = getDirection(useLocale()) === 'rtl';
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
  const [{ active, previous }, setSlides] = useState<SlideState>({ active: 0, previous: null });
  const [stopped, setStopped] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [inView, setInView] = useState(true);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const swipeStartX = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const total = slides.length;
  const autoplay = hydrated && !reducedMotion && total > 1 && !stopped;
  const state = carouselState({
    hydrated,
    reducedMotion,
    stopped,
    hovered: hovering,
    inView,
    total,
  });

  const goTo = (index: number) => {
    const next = wrapIndex(index, total);
    if (next !== active) {
      setSlides({ active: next, previous: active });
    }
  };

  const onProgressEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.target === event.currentTarget && state === 'running') {
      goTo(active + 1);
    }
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = stepFromKey(event.key, rtl);
    if (step === null) {
      return;
    }
    event.preventDefault();
    const target = resolveKeyTarget(step, active, total);
    goTo(target);
    setStopped(true);
    tabRefs.current[target]?.focus();
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    // Keyboard focus only: a mouse click on a control has its own handler.
    if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) {
      setStopped(true);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeStartX.current = event.pointerType === 'mouse' ? null : event.clientX;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null) {
      return;
    }
    const step = stepFromSwipe(event.clientX - swipeStartX.current, rtl);
    swipeStartX.current = null;
    if (step !== 0) {
      goTo(active + step);
      setStopped(true);
    }
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0"
      data-carousel-state={state}
      style={{ '--hero-interval': `${INTERVAL_MS}ms` } as CSSProperties}
      onFocus={onFocus}
      onPointerEnter={(event) => event.pointerType === 'mouse' && setHovering(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setHovering(false)}
    >
      <div
        className="absolute inset-0 touch-pan-y"
        aria-live={autoplay ? 'off' : 'polite'}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStartX.current = null;
        }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.key}
            id={`hero-slide-${slide.key}`}
            role="tabpanel"
            aria-roledescription="slide"
            aria-label={slide.slideLabel}
            data-hero-slide=""
            data-active={index === active ? '' : undefined}
            data-leaving={index === previous ? '' : undefined}
            inert={index !== active}
            className="absolute inset-0"
          >
            {slide.content}
          </div>
        ))}
      </div>

      {total > 1 && (
        <div data-hero-tabs="" className="absolute inset-x-0 bottom-0">
          <Container as="div" className="pb-6 lg:pb-10">
            <div
              role="tablist"
              aria-label={tabListLabel}
              className="grid gap-2 md:gap-6"
              style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
            >
              {slides.map((slide, index) => {
                const selected = index === active;
                return (
                  <button
                    key={slide.key}
                    ref={(element) => {
                      tabRefs.current[index] = element;
                    }}
                    type="button"
                    role="tab"
                    id={`hero-tab-${slide.key}`}
                    aria-selected={selected}
                    aria-controls={`hero-slide-${slide.key}`}
                    tabIndex={selected ? 0 : -1}
                    data-hero-tab=""
                    onClick={() => {
                      goTo(index);
                      setStopped(true);
                    }}
                    onKeyDown={onTabKeyDown}
                    className="group flex min-h-11 flex-col justify-end gap-3 text-start"
                  >
                    <span className="block h-px w-full overflow-hidden bg-text/30">
                      <span
                        data-hero-progress=""
                        onAnimationEnd={selected ? onProgressEnd : undefined}
                        className="block h-full w-full bg-text"
                      />
                    </span>
                    {/* The label is always visible, so the current slide is shown by
                        text weight and colour (and aria-selected), never only by the
                        moving progress line. A responsive type pair: caption on phones. */}
                    <span
                      className={cn(
                        'type-caption md:type-label truncate',
                        'transition-colors duration-fast ease-ui',
                        selected
                          ? 'font-medium text-text'
                          : 'text-text-secondary group-hover:text-text'
                      )}
                    >
                      {slide.tabLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </Container>
        </div>
      )}
    </div>
  );
}
