import React, { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  onClick?: () => void;
  isCurrent?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  className?: string;
}

export function Breadcrumbs({
  items,
  separator,
  className = '',
}: BreadcrumbsProps): React.JSX.Element {
  if (!items || items.length === 0) return <></>;

  return (
    <nav
      aria-label="Breadcrumbs"
      className={`flex items-center text-xs text-muted-foreground ${className}`}
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = item.isCurrent !== undefined ? item.isCurrent : isLast;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="font-medium text-foreground truncate max-w-[200px]"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <a
                  href={item.href}
                  onClick={item.onClick}
                  className="hover:text-foreground transition-colors truncate max-w-[150px] focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                >
                  {item.label}
                </a>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="hover:text-foreground transition-colors truncate max-w-[150px] focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                >
                  {item.label}
                </button>
              ) : (
                <span className="truncate max-w-[150px]">{item.label}</span>
              )}

              {!isLast && (
                <span className="text-muted-foreground/60 flex-shrink-0" aria-hidden="true">
                  {separator || <ChevronRight className="h-3.5 w-3.5" />}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
