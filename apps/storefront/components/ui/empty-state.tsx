import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Empty, filtered-empty and error states: a small gold crescent drawn in line (the
 * logo's crescent reduced to a stroke — an ornament, not the mark), a title, one
 * sentence and one way forward. The title is the caller's heading level; `titleRef`
 * and a -1 tab index let a flow move focus to it (the bag after its last Remove).
 *
 * `align="start"` (default) sits in the content's place, like the 404 page;
 * `center` is for a state that stands alone in a drawer or panel.
 */
export function EmptyState({
  title,
  titleAs: Heading = 'h2',
  titleRef,
  titleFocusable = false,
  body,
  actions,
  align = 'start',
  ornament = true,
  className,
}: {
  title: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3';
  titleRef?: Ref<HTMLHeadingElement>;
  /** Makes the heading programmatically focusable (`tabIndex=-1`) for a focus hand-off. */
  titleFocusable?: boolean;
  body?: ReactNode;
  /** One primary way forward (a Button or EditorialLink), optionally a second quiet one. */
  actions?: ReactNode;
  align?: 'start' | 'center';
  ornament?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 py-14 md:py-20',
        align === 'center' ? 'items-center text-center' : 'items-start',
        className
      )}
    >
      {ornament && <Crescent />}
      <Heading
        ref={titleRef}
        tabIndex={titleFocusable ? -1 : undefined}
        className="type-title max-w-md text-balance focus:outline-none"
      >
        {title}
      </Heading>
      {body && <p className="type-body max-w-md text-text-secondary">{body}</p>}
      {actions && (
        <div
          className={cn(
            'mt-4 flex flex-wrap items-center gap-x-8 gap-y-4',
            align === 'center' && 'justify-center'
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

/** A crescent and four-point star in one gold stroke, 48px. Decorative. */
export function Crescent({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={cn('size-12 shrink-0 text-metallic', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path d="M38 8a24 24 0 1 0 18 38A20 20 0 0 1 38 8z" />
      <path d="M50 14l1.2 3.2L54.4 18l-3.2 1.2L50 22.4l-1.2-3.2L45.6 18l3.2-.8z" />
    </svg>
  );
}
