import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';

export interface NavLinkProps extends ComponentProps<typeof Link> {
  /**
   * Whether this link matches the current page. The header and footer still pass
   * `false` (their `aria-current` needs the segment passed down, deferred); the
   * catalog's category row passes `true` for its own page.
   */
  current?: boolean;
  /**
   * Overrides the default `type-ui` treatment. tailwind-merge doesn't know our
   * custom `type-*` utilities (see apps/storefront/CLAUDE.md), so passing a second
   * one via `className` would leave both applied — whichever compiles later in
   * globals.css would silently win. The mobile menu's primary links need a display
   * step; this prop is the one place that's chosen, so only one `type-*` class is
   * ever present.
   */
  typography?: string;
  className?: string;
}

/**
 * The one nav link style, used by the header, footer and mobile menu. Rest: text
 * colour, sentence case (`type-ui`). Hover/focus-visible: a 1px accent rule grows from
 * the inline start. Current: aria-current plus a persistent rule.
 */
export function NavLink({
  current = false,
  typography = 'type-ui',
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
        'relative inline-block py-1 text-text transition-colors duration-fast ease-ui',
        'after:absolute after:bottom-0 after:start-0 after:h-px after:w-full after:bg-current',
        // Scale, not width: the underline grows on the compositor.
        'after:origin-left rtl:after:origin-right',
        'after:transition-transform after:duration-base after:ease-ui',
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
