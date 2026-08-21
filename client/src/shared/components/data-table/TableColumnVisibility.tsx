import React, { useState, useRef, useEffect } from 'react';
import { Columns3, Check } from 'lucide-react';
import type { Table } from '@tanstack/react-table';

export interface TableColumnVisibilityProps<TData> {
  table: Table<TData>;
  className?: string;
}

export function TableColumnVisibility<TData>({
  table,
  className = '',
}: TableColumnVisibilityProps<TData>): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const columns = table.getAllLeafColumns().filter((col) => col.getCanHide());

  if (columns.length === 0) return <></>;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Toggle column visibility"
        className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Columns3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span>Columns</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Columns visibility"
          className="absolute end-0 z-40 mt-1 min-w-[160px] rounded-xl border border-border bg-card p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Toggle Columns
          </div>
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {columns.map((column) => {
              const isVisible = column.getIsVisible();
              const headerText =
                typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id;

              return (
                <button
                  key={column.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isVisible}
                  onClick={() => column.toggleVisibility(!isVisible)}
                  className="flex items-center justify-between w-full px-2 py-1.5 text-xs text-start text-foreground rounded-md hover:bg-muted transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <span className="capitalize truncate">{headerText}</span>
                  {isVisible && <Check className="h-3.5 w-3.5 text-primary ms-2 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default TableColumnVisibility;
