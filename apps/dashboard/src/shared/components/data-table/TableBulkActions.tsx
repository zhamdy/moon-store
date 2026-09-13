import React, { type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface TableBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  children?: ReactNode;
  className?: string;
}

export function TableBulkActions({
  selectedCount,
  onClearSelection,
  children,
  className = '',
}: TableBulkActionsProps): React.JSX.Element | null {
  if (selectedCount <= 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions toolbar"
      className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 text-primary-foreground shadow-sm animate-in fade-in-50 slide-in-from-bottom-2 duration-150 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground px-2 py-0.5 rounded-full bg-primary/20">
          {selectedCount} selected
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          aria-label="Deselect all rows"
          className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

export default TableBulkActions;
