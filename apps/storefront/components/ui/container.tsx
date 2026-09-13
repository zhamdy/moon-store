import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type ContainerElement = 'div' | 'section' | 'header' | 'footer' | 'nav';

export interface ContainerProps {
  as?: ContainerElement;
  /** Drops the max width and gutters, letting content run full-bleed. */
  bleed?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * The one place --container-max and --page-gutter (app/globals.css) are consumed.
 * There is no separate Tailwind container utility — this component is it.
 */
export function Container({ as = 'div', bleed = false, className, children }: ContainerProps) {
  const Component = as;

  return (
    <Component
      className={cn('mx-auto', className)}
      style={
        bleed
          ? undefined
          : { maxInlineSize: 'var(--container-max)', paddingInline: 'var(--page-gutter)' }
      }
    >
      {children}
    </Component>
  );
}
