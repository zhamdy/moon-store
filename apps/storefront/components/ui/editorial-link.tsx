import type { ComponentProps, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';

export interface EditorialLinkProps extends Omit<ComponentProps<typeof Link>, 'className'> {
  tone?: 'text' | 'brand';
  /**
   * `hover` (default) grows the rule from nothing on hover/focus — the quiet
   * in-page treatment. `always` keeps it drawn at rest, for a link that has to read as
   * the section's call to action from across the room (the hero, a campaign).
   */
  underline?: 'hover' | 'always';
  className?: string;
  children: ReactNode;
}

/**
 * "Explore the selection →". The design system's editorial link: `type-label` (13px,
 * uppercase, 0.12em in English; 16px, untracked in Arabic), a 1px rule in the text
 * colour, and an arrow that points the way the page reads.
 *
 * The underline is a background-size trick (0% at rest, 100% on hover/focus-visible)
 * rather than a real text-decoration, so its growth origin can flip with direction:
 * left in LTR, right under [dir="rtl"], via Tailwind's rtl: variant. Reduced motion
 * already collapses the transition globally (app/globals.css).
 *
 * The rule is `currentColor`, so a colour transition on the link carries it too —
 * which is how the `always` variant goes to the accent on hover without a second rule.
 */
export function EditorialLink({
  tone = 'text',
  underline = 'hover',
  className,
  children,
  ...props
}: EditorialLinkProps) {
  return (
    <Link
      {...props}
      className={cn(
        'group inline-flex min-h-(--size-tap) items-center gap-2.5 type-label',
        'bg-no-repeat bg-[position:0_calc(100%-10px)] rtl:bg-[position:100%_calc(100%-10px)]',
        '[background-image:linear-gradient(currentColor,currentColor)]',
        'transition-[background-size,color] duration-fast ease-ui',
        underline === 'always'
          ? 'bg-[length:100%_1px] hover:text-brand'
          : 'bg-[length:0%_1px] hover:bg-[length:100%_1px] focus-visible:bg-[length:100%_1px]',
        tone === 'brand' ? 'text-brand hover:text-brand-dark' : 'text-text',
        className
      )}
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        size={16}
        strokeWidth={1.5}
        className="shrink-0 transition-transform duration-fast ease-ui group-hover:translate-x-1 group-focus-visible:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 rtl:group-focus-visible:-translate-x-1"
      />
    </Link>
  );
}
