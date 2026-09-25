import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type NoticeTone = 'notice' | 'error' | 'success' | 'neutral';

const ICONS = { notice: Info, error: CircleAlert, success: CircleCheck, neutral: Info } as const;

/**
 * An inline notice: the outcome first, then what to do, then at most one action.
 *
 * - `notice` (default): a Sand band, the icon in bronze-deep — the bag was updated, a
 *   quantity is limited, a price changed.
 * - `error`: a garnet hairline and garnet icon and lead — something failed or blocks.
 * - `success`: a hairline and a moss icon.
 * - `neutral`: a hairline and the text colour — information with no state.
 *
 * A band or a hairline box, never a coloured stripe down one side. Not a live region
 * by itself: pass `role="status"` or `role="alert"` where the notice appears in response
 * to an action and nothing else announces it (the bag's toasts already do).
 */
export function Notice({
  tone = 'notice',
  title,
  children,
  action,
  role,
  className,
}: {
  tone?: NoticeTone;
  /** The outcome, in bold. */
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: 'status' | 'alert';
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      role={role}
      className={cn(
        'type-supporting flex items-start gap-3 rounded-control px-4 py-3.5',
        tone === 'notice'
          ? 'bg-notice-surface text-ink'
          : 'border border-border bg-surface text-text',
        tone === 'error' && 'border-danger',
        className
      )}
    >
      <Icon
        size={18}
        strokeWidth={1.5}
        aria-hidden="true"
        className={cn(
          'mt-0.5 shrink-0',
          tone === 'notice' && 'text-notice',
          tone === 'error' && 'text-danger',
          tone === 'success' && 'text-success'
        )}
      />
      <div className="min-w-0 flex-1">
        {title && <p className={cn('font-semibold', tone === 'error' && 'text-danger')}>{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
