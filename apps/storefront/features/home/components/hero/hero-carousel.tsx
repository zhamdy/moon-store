'use client';

import {
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
import { Pause, Play } from 'lucide-react';
import { getDirection } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils/cn';
import { resolveKeyTarget, stepFromKey, stepFromSwipe, wrapIndex } from './hero-carousel-state';

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
  pauseLabel: string;
  playLabel: string;
}

const INTERVAL_MS = 7000;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const subscribeNever = () => () => {};
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * The hero's slides, on the WAI-ARIA tabbed carousel pattern: a rotation control
 * first, a tablist of collection names, one tabpanel per slide. Inactive slides
 * are `inert` and hidden, so assistive tech and the keyboard only ever meet the
 * visible one.
 *
 * Rotation is driven by the active tab's CSS progress bar: its `animationend`
 * advances the slide, so pausing the animation pauses the timer with no drift.
 * Autoplay never starts before hydration or under reduced motion (read live, so
 * turning the setting on mid-session stops it). Hovering pauses it until the
 * pointer leaves; keyboard focus inside the carousel, a tab click, an arrow key or
 * a swipe stops it until the play button is pressed. The live region is `off`
 * while rotating and `polite` once stopped.
 *
 * A client leaf: slide content arrives server-rendered as children, and every
 * string arrives resolved. Transitions and entrances are CSS keyed on
 * `data-active` — see "Hero slides" in app/globals.css.
 */
export function HeroCarousel({ slides, tabListLabel, pauseLabel, playLabel }: HeroCarouselProps) {
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
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [hovering, setHovering] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const swipeStartX = useRef<number | null>(null);

  const total = slides.length;
  const canAutoplay = hydrated && !reducedMotion && total > 1;
  const autoplay = canAutoplay && !stopped;
  const state = autoplay ? (hovering ? 'paused' : 'running') : 'stopped';

  const goTo = (index: number) => setActive(wrapIndex(index, total));

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
            inert={index !== active}
            className="absolute inset-0"
          >
            {slide.content}
          </div>
        ))}
      </div>

      {total > 1 && (
        <div className="absolute inset-x-0 bottom-0">
          <Container as="div" className="flex items-end gap-3 pb-6 md:gap-6 lg:pb-10">
            <button
              type="button"
              onClick={() => setStopped((value) => !value)}
              aria-label={autoplay ? pauseLabel : playLabel}
              aria-hidden={canAutoplay ? undefined : true}
              tabIndex={canAutoplay ? 0 : -1}
              className={cn(
                '-ms-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-text',
                'transition-opacity duration-fast ease-ui hover:opacity-70',
                !canAutoplay && 'invisible'
              )}
            >
              {autoplay ? (
                <Pause size={18} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Play size={18} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>

            <div
              role="tablist"
              aria-label={tabListLabel}
              className="grid flex-1 gap-2 md:gap-6"
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
                    <span
                      className={cn(
                        'type-label sr-only md:not-sr-only',
                        'transition-colors duration-fast ease-ui',
                        selected ? 'text-text' : 'text-text-secondary group-hover:text-text'
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
