'use client';

import Image from 'next/image';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { GALLERY_ZOOM_QUERY, galleryKeyTarget } from '../utils/gallery-layout';

/** One photograph, with every string resolved on the server. */
export interface GalleryViewerImage {
  url: string;
  alt: string;
  /** "Image 2 of 6"; only read when there is a thumbnail column. */
  thumbLabel?: string;
  sizes: string;
  zoomSizes: string;
  loading?: 'eager';
  fetchPriority?: 'high';
}

export interface ProductGalleryViewerProps {
  images: GalleryViewerImage[];
  /** The thumbnail photograph's `sizes`; required with two or more images. */
  thumbSizes?: string;
  /** The tablist's accessible name. */
  label: string;
  dir: 'ltr' | 'rtl';
}

function subscribeZoom(onChange: () => void) {
  const query = window.matchMedia(GALLERY_ZOOM_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const zoomSnapshot = () => window.matchMedia(GALLERY_ZOOM_QUERY).matches;
const serverZoomSnapshot = () => false;

function withIndex(set: ReadonlySet<number>, index: number): ReadonlySet<number> {
  return set.has(index) ? set : new Set(set).add(index);
}

/**
 * The product gallery (owner decision 2026-09-14, the Bella template's gallery): a
 * vertical tablist of thumbnails beside one large image, and zoom in place for a
 * precise hovering pointer. Thumbnail state and pointer zoom cannot be CSS, so this is
 * the storefront's eleventh client boundary; layout, fades and zoom scale are CSS
 * (`[data-gallery*]` in `app/globals.css`).
 *
 * A large image mounts only once it has been shown (the first on the server), and stays
 * mounted, hidden, for instant re-selection: lazy alone would not stop hidden panes
 * laid out in the frame from downloading. The zoom image mounts on a pane's first zoom.
 */
export function ProductGalleryViewer({
  images,
  thumbSizes,
  label,
  dir,
}: ProductGalleryViewerProps) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const tabId = (index: number) => `${baseId}-tab-${index}`;
  const count = images.length;
  const withThumbs = count > 1;

  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [shown, setShown] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [zoomMounted, setZoomMounted] = useState<ReadonlySet<number>>(() => new Set());
  const [zoomLoaded, setZoomLoaded] = useState<ReadonlySet<number>>(() => new Set());
  const [hovering, setHovering] = useState(false);
  const canZoom = useSyncExternalStore(subscribeZoom, zoomSnapshot, serverZoomSnapshot);
  const zoomed = canZoom && hovering;

  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const frame = useRef<HTMLDivElement>(null);
  const originRequest = useRef(0);
  const origin = useRef({ x: 50, y: 50 });

  useEffect(() => () => cancelAnimationFrame(originRequest.current), []);

  function select(index: number) {
    if (index === active) return;
    setPrevious(active);
    setActive(index);
    setShown((set) => withIndex(set, index));
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = galleryKeyTarget(event.key, active, count, dir);
    if (target === null) return;
    event.preventDefault();
    select(target);
    tabs.current[target]?.focus();
  }

  function writeOrigin() {
    originRequest.current = 0;
    frame.current?.style.setProperty('--zoom-x', `${origin.current.x}%`);
    frame.current?.style.setProperty('--zoom-y', `${origin.current.y}%`);
  }

  // Physical coordinates on purpose: the photograph is never mirrored, so neither is zoom.
  function trackPointer(event: PointerEvent<HTMLDivElement>, immediate: boolean) {
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.min(100, Math.max(0, value));
    origin.current = {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    };
    if (immediate) {
      cancelAnimationFrame(originRequest.current);
      writeOrigin();
    } else if (!originRequest.current) {
      originRequest.current = requestAnimationFrame(writeOrigin);
    }
  }

  function onPointerEnter(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || !canZoom) return;
    trackPointer(event, true);
    setHovering(true);
    setZoomMounted((set) => withIndex(set, active));
  }

  return (
    <div data-gallery>
      {withThumbs && (
        <div data-gallery-thumbs>
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label={label}
            onKeyDown={onTabKeyDown}
          >
            {images.map((image, index) => (
              <button
                key={index}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={tabId(index)}
                aria-selected={index === active}
                aria-controls={panelId}
                aria-label={image.thumbLabel}
                tabIndex={index === active ? 0 : -1}
                data-gallery-thumb
                onClick={() => select(index)}
              >
                <span>
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes={thumbSizes}
                    loading="eager"
                    fetchPriority="low"
                    className="object-cover"
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={frame}
        data-gallery-frame
        data-zoomable={canZoom ? '' : undefined}
        data-zoomed={zoomed ? '' : undefined}
        onPointerEnter={onPointerEnter}
        onPointerMove={zoomed ? (event) => trackPointer(event, false) : undefined}
        onPointerLeave={() => setHovering(false)}
        {...(withThumbs ? { id: panelId, role: 'tabpanel', 'aria-labelledby': tabId(active) } : {})}
      >
        <div data-gallery-zoom>
          {images.map((image, index) => {
            if (!shown.has(index)) return null;
            const isActive = index === active;
            const isPrevious = index === previous;
            return (
              <div
                key={index}
                data-gallery-pane
                data-state={isActive ? 'active' : isPrevious ? 'previous' : undefined}
                // Only a change fades: the first image is the LCP and never animates in.
                data-fade={isActive && previous !== null ? '' : undefined}
                hidden={!isActive && !isPrevious}
                aria-hidden={isActive ? undefined : true}
              >
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes={image.sizes}
                  loading={image.loading}
                  fetchPriority={image.fetchPriority}
                  className="object-cover"
                />
                {zoomMounted.has(index) && (
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes={image.zoomSizes}
                    data-gallery-hires
                    data-loaded={zoomLoaded.has(index) ? '' : undefined}
                    onLoad={() => setZoomLoaded((set) => withIndex(set, index))}
                    className="object-cover"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
