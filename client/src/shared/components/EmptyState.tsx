import type { LucideIcon } from 'lucide-react';
import { Button } from '@heroui/react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Whether this element is its own live region.
   *
   * Standalone callers keep it: the component mounting *is* the news. A caller that
   * already owns a persistent live region must pass `false`, or the page announces the
   * same emptiness twice — and from a region that did not exist a moment earlier, which
   * is the mounting pattern that announces unreliably in the first place.
   */
  announce?: boolean;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  announce = true,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      {...(announce ? { role: 'status', 'aria-live': 'polite' as const } : {})}
    >
      <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-3 text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
      {description && <p className="text-xs text-muted-foreground mb-4 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="flat" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
