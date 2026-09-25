import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Availability and stock status in running text: "In stock", "Only 2 available",
 * "Sold out". A small dot in the status colour before the words — never colour alone.
 * `success` moss 7.6:1, `notice` bronze-deep 8.0:1, `danger` garnet 7.1:1 on Ivory;
 * `neutral` the secondary text colour.
 */
export function StatusText({
  tone,
  className,
  children,
}: {
  tone: 'success' | 'notice' | 'danger' | 'neutral';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'type-supporting inline-flex items-center gap-2 font-medium',
        tone === 'success' && 'text-success',
        tone === 'notice' && 'text-notice',
        tone === 'danger' && 'text-danger',
        tone === 'neutral' && 'text-text-secondary',
        className
      )}
    >
      <span aria-hidden="true" className="size-[7px] shrink-0 rounded-pill bg-current" />
      {children}
    </span>
  );
}
