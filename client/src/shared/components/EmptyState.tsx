import type { LucideIcon } from 'lucide-react';
import { Button } from '@heroui/react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      role="status"
      aria-live="polite"
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
