import type { ComponentProps, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';

export interface EditorialLinkProps extends Omit<ComponentProps<typeof Link>, 'className'> {
  tone?: 'text' | 'brand';
  className?: string;
  children: ReactNode;
}

/**
 * "Explore Collection →" — guideline §9. The underline is a background-size trick
 * (0% at rest, 100% on hover/focus-visible) rather than a real text-decoration, so
 * its growth origin can flip with direction: left in LTR, right under [dir="rtl"],
 * via Tailwind's rtl: variant. Reduced motion already collapses the transition
 * globally (app/globals.css), so no separate handling is needed here.
 */
export function EditorialLink({
  tone = 'text',
  className,
  children,
  ...props
}: EditorialLinkProps) {
  return (
    <Link
      {...props}
      className={cn(
        'group inline-flex items-center gap-1.5 type-label normal-case tracking-normal',
        'bg-no-repeat bg-left-bottom rtl:bg-right-bottom',
        '[background-image:linear-gradient(currentColor,currentColor)] bg-[length:0%_1px]',
        'transition-[background-size] duration-fast ease-ui',
        'hover:bg-[length:100%_1px] focus-visible:bg-[length:100%_1px]',
        tone === 'brand' ? 'text-brand-dark' : 'text-text',
        className
      )}
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        size={16}
        className="transition-transform duration-fast ease-ui group-hover:translate-x-1 group-focus-visible:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 rtl:group-focus-visible:-translate-x-1"
      />
    </Link>
  );
}
