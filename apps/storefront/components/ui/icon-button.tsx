import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'> {
  /** Required: an icon button has no visible text, so this is its whole name. */
  'aria-label': string;
  /**
   * `plain` (default): a 44px square hit area around the glyph, no fill — the header,
   * drawer and sheet close buttons. `disc`: a 44px Ivory disc that holds its own over a
   * photograph (the product card's action), with the overlay shadow. `outline`: a 48px
   * circle with a control-colour hairline (a rail's previous/next).
   */
  variant?: 'plain' | 'disc' | 'outline';
  /**
   * Mirror the glyph under `dir="rtl"`, for directional icons (arrows, chevrons). Never
   * for a glyph that means the same thing both ways (close, plus, bag).
   */
  directional?: boolean;
}

/**
 * The icon-only button. The glyph is the caller's (`lucide-react`, 20px, strokeWidth
 * 1.5, `aria-hidden`); this sets the hit area, the states and the name.
 */
export function IconButton({
  variant = 'plain',
  directional = false,
  type = 'button',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center text-text',
        'transition-[background-color,color,border-color,opacity] duration-fast ease-ui',
        'disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40',
        directional && '[&_svg]:rtl:-scale-x-100',
        variant === 'plain' && 'size-(--size-tap) hover:opacity-70',
        variant === 'disc' && [
          'size-(--size-tap) rounded-pill bg-ivory/95 text-ink shadow-(--shadow-overlay)',
          'hover:bg-ink hover:text-ivory',
        ],
        variant === 'outline' && [
          'size-12 rounded-pill border border-control',
          'hover:border-text hover:bg-text hover:text-on-action',
        ],
        className
      )}
    >
      {children}
    </button>
  );
}
