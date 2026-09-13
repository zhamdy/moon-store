import React, { type ReactNode } from 'react';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbItem[] | ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  tabs,
  children,
  className = '',
}: PageHeaderProps): React.JSX.Element {
  const renderedActions = actions || children;

  return (
    <div className={`flex flex-col gap-4 pb-5 border-b border-border ${className}`}>
      {/* Breadcrumbs */}
      {breadcrumbs && (
        <div className="flex items-center">
          {Array.isArray(breadcrumbs) ? <Breadcrumbs items={breadcrumbs} /> : breadcrumbs}
        </div>
      )}

      {/* Main Row: Title, Badge, Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {badge && <div className="flex items-center">{badge}</div>}
          </div>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>

        {renderedActions && (
          <div className="flex items-center gap-2.5 flex-wrap sm:ms-auto">{renderedActions}</div>
        )}
      </div>

      {/* Sub-tabs Navigation */}
      {tabs && <div className="pt-2">{tabs}</div>}
    </div>
  );
}

export default PageHeader;
