import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type ContainerElement = 'div' | 'section' | 'header' | 'footer' | 'nav';

export interface ContainerProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'className' | 'style' | 'children'
> {
  as?: ContainerElement;
  /** Drops the max width and gutters, letting content run full-bleed. */
  bleed?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * The one place --container-max and --page-gutter (app/globals.css) are consumed.
 * There is no separate Tailwind container utility — this component is it.
 *
 * Every other HTML attribute (`id`, `aria-*`, `role`, `data-*`, handlers) is
 * forwarded to the rendered element. It used to be dropped, and TypeScript never
 * noticed: hyphenated JSX attributes such as `aria-labelledby` are not checked
 * against a component's props, so every homepage `<section>` silently lost its
 * accessible name. `style` stays excluded because the gutters own it.
 */
export function Container({
  as = 'div',
  bleed = false,
  className,
  children,
  ...rest
}: ContainerProps) {
  const Component = as;

  return (
    <Component
      {...rest}
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
