import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';

export interface NavLinkProps extends ComponentProps<typeof Link> {
  /**
   * Whether this link matches the current page. There is no real routing yet
   * (every nav target 404s through the catch-all — see Scope Boundaries), so
   * every caller passes `false` today; this prop is the seam a future page
   * wires up.
   */
  current?: boolean;
  /**
   * Overrides the default `type-label` treatment. tailwind-merge doesn't know our
   * custom `type-*` utilities (see apps/storefront/CLAUDE.md), so passing a second
   * one via `className` would leave both applied — whichever compiles later in
   * globals.css would silently win. The mobile menu's primary links need
   * `type-h3` (a deliberate editorial exception, guideline §5); this prop is the
   * one place that's chosen, so only one `type-*` class is ever present.
   */
  typography?: string;
  className?: string;
}

/**
 * The one nav link style, used by the header, footer and mobile menu — guideline
 * §8/§9. Rest: text colour. Hover/focus-visible: a 1px brand underline grows from
 * the inline start. Current: aria-current plus a persistent hairline.
 */
export function NavLink({
  current = false,
  typography = 'type-label',
  className,
  children,
  ...props
}: NavLinkProps) {
  return (
    <Link
      {...props}
      aria-current={current ? 'page' : undefined}
      className={cn(
        typography,
        'relative inline-block pb-1 text-text transition-colors duration-fast ease-ui',
        'after:absolute after:bottom-0 after:start-0 after:h-px after:w-full after:bg-brand',
        // Scale, not width: the underline grows on the compositor.
        'after:origin-left rtl:after:origin-right',
        'after:transition-transform after:duration-[260ms] after:ease-ui',
        current
          ? 'after:scale-x-100'
          : 'after:scale-x-0 hover:after:scale-x-100 focus-visible:after:scale-x-100',
        className
      )}
    >
      {children}
    </Link>
  );
}
