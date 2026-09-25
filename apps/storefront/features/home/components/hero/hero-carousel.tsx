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
import { Pause, Play } from 'lucide-react';
import { useLocale } from 'next-intl';
import { getDirection } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';
import {
  carouselState,
  resolveKeyTarget,
  slideMediaVisible,
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
  /**
   * Server-rendered photograph, rendered only while `slideMediaVisible` says so, so
   * hidden slides do not download theirs on first load.
   */
  media: ReactNode;
  /** Server-rendered scrims and copy, always rendered. */
  content: ReactNode;
}

export interface HeroCarouselProps {
  slides: HeroCarouselSlide[];
  tabListLabel: string;
  /** `home.hero.pause` / `home.hero.play`, resolved on the server. */
  playbackLabels: { pause: string; play: string };
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
 * **The collection index** (2026-09-20) is what that tablist looks like: one line of
 * collection names at the foot of the frame, under a hairline that runs gutter to
 * gutter, at the inline end from 1024 so it balances the masthead at the inline
 * start. The current collection is ivory over dimmed ivory with a gold rule drawn
 * under it; the four equal columns, each with its own progress bar, are gone —
 * that arrangement is what made a campaign read as a row of tabs. Active is marked
 * by brightness *and* a rule, never by colour alone.
 *
 * Rotation is driven by one progress line at the very bottom edge of the hero,
 * full-bleed under the index: its `animationend` advances the slide, so pausing the
 * animation pauses the timer with no drift. It is keyed on the active index, so a
 * slide change remounts it and restarts the fill. Two facts, two elements — which
 * collection you are on, and how long it stays.
 *
 * Autoplay never starts before hydration or under reduced motion (read live, so
 * turning the setting on mid-session stops it). Hovering pauses rotation until the
 * pointer leaves, and keyboard focus inside the carousel, a tab click, an arrow key
 * or a swipe stops it for the rest of the visit. **Since homepage Phase 2
 * (2026-09-25) there is also a visible Pause / Play button** beside a `01 / 04`
 * counter at the index row's inline start: the Claude Design direction drew one, and
 * it is the plain WCAG 2.2.2 mechanism for a touch user who never focuses anything.
 * It is only rendered while autoplay is possible (hydrated, no reduced motion), so the
 * server HTML and a reduced-motion visit show no control that could do nothing.
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
 *
 * Photographs load on demand: the lead slide's is in the server HTML, the next
 * slide's is added while rotating, and a slide that is hovered, focused or shown
 * keeps its photograph from then on (`slideMediaVisible`).
 */
export function HeroCarousel({ slides, tabListLabel, playbackLabels }: HeroCarouselProps) {
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
  const [primed, setPrimed] = useState<readonly number[]>([]);
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

  const prime = (...indices: number[]) => {
    setPrimed((current) => {
      const added = indices
        .map((index) => wrapIndex(index, total))
        .filter(
          (index, position, all) => !current.includes(index) && all.indexOf(index) === position
        );
      return added.length > 0 ? [...current, ...added] : current;
    });
  };

  const goTo = (index: number) => {
    const next = wrapIndex(index, total);
    prime(active, next);
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
            className="absolute inset-0 overflow-hidden"
          >
            {/* Photographic Stage: the full frame, edge to edge, at every breakpoint */}
            {slideMediaVisible({
              index,
              active,
              previous,
              total,
              rotating: state === 'running' || state === 'paused',
              primed,
            }) && slide.media}

            {/* The masthead stands on the floor of the frame at every width. Its
                bottom padding is the collection index's band plus a clear gap, so
                the copy never crowds the hairline. */}
            <div className="absolute inset-0 z-10 flex flex-col justify-end px-(--page-gutter) pt-(--header-h) pb-28 lg:pb-36">
              <div className="w-full max-w-[42rem] xl:max-w-[52rem]">{slide.content}</div>
            </div>
          </div>
        ))}
      </div>

      {total > 1 && (
        <nav
          data-hero-tabs=""
          aria-label={tabListLabel}
          className="absolute inset-x-0 bottom-0 z-20"
        >
          <div className="px-(--page-gutter)">
            <div className="border-t border-text/15">
              {/* Four short names fit at 375 but not always at 320, and never with a
                  longer collection name — the row scrolls rather than wrapping, which
                  would put one name on a line of its own under the rule. */}
              <div className="flex items-center gap-4 sm:gap-6">
                {hydrated && !reducedMotion && (
                  <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                    <button
                      type="button"
                      aria-label={stopped ? playbackLabels.play : playbackLabels.pause}
                      onClick={() => setStopped((value) => !value)}
                      className="flex size-(--size-tap) cursor-pointer items-center justify-center rounded-pill border border-text/40 text-text transition-colors duration-fast ease-ui hover:border-text"
                    >
                      {stopped ? (
                        <Play aria-hidden="true" size={14} strokeWidth={1.5} fill="currentColor" />
                      ) : (
                        <Pause aria-hidden="true" size={14} strokeWidth={1.5} fill="currentColor" />
                      )}
                    </button>
                    <span
                      aria-hidden="true"
                      className="type-caption hidden tabular-nums text-brand sm:inline"
                      dir="ltr"
                    >
                      {String(active + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                    </span>
                  </div>
                )}
                <div data-hero-index="" className="min-w-0 flex-1 overflow-x-auto">
                  <div
                    role="tablist"
                    aria-label={tabListLabel}
                    className="flex min-w-max items-center gap-6 sm:gap-8 lg:min-w-0 lg:w-full lg:justify-end lg:gap-12"
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
                          onPointerEnter={() => prime(index)}
                          onFocus={() => prime(index - 1, index, index + 1)}
                          className="group relative flex min-h-11 shrink-0 items-center whitespace-nowrap"
                        >
                          <span
                            className={cn(
                              'type-ui transition-colors duration-fast',
                              selected
                                ? 'text-text'
                                : 'text-text-secondary/60 group-hover:text-text'
                            )}
                          >
                            {slide.tabLabel}
                          </span>
                          {/* The current collection's rule. Brightness marks it too, so
                            this is emphasis, not the only signal. */}
                          <span
                            aria-hidden="true"
                            className={cn(
                              'pointer-events-none absolute inset-x-0 bottom-2 h-px origin-left rtl:origin-right bg-gold transition-transform duration-base ease-editorial',
                              selected ? 'scale-x-100' : 'scale-x-0'
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* The timer: one full-bleed line at the hero's bottom edge. Keyed on the
              active slide, so every change restarts the fill from zero. */}
          <span aria-hidden="true" className="block h-[2px] w-full bg-text/15">
            <span
              key={active}
              data-hero-progress=""
              onAnimationEnd={onProgressEnd}
              className="block h-full w-full bg-gold"
            />
          </span>
        </nav>
      )}
    </div>
  );
}
