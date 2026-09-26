import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type ContainerElement = 'div' | 'section' | 'header' | 'footer' | 'nav';

/**
 * `page` (default, `--container-max` 1440): every commerce page and most sections.
 * `wide` (`--container-wide` 1680): editorial compositions that want more room.
 * `editorial` (`--container-editorial` 1120): a text-led column (long copy, a quiet
 * chapter) that should not run the full page width.
 * Full-bleed photography uses `bleed` and ignores all three.
 */
export type ContainerSize = 'page' | 'wide' | 'editorial';

const MAX: Record<ContainerSize, string> = {
  page: 'var(--container-max)',
  wide: 'var(--container-wide)',
  editorial: 'var(--container-editorial)',
};

export interface ContainerProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'className' | 'style' | 'children'
> {
  as?: ContainerElement;
  size?: ContainerSize;
  /** Drops the max width and gutters, letting content run full-bleed. */
  bleed?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * The one place the container widths and --page-gutter (app/globals.css) are consumed.
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
  size = 'page',
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
      style={bleed ? undefined : { maxInlineSize: MAX[size], paddingInline: 'var(--page-gutter)' }}
    >
      {children}
    </Component>
  );
}
