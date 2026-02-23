import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-data transition-colors focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-gold text-primary-foreground',
        secondary: 'border-transparent bg-surface text-foreground',
        destructive: 'border-transparent bg-destructive text-foreground',
        outline: 'text-foreground border-border',
        gold: 'border-transparent bg-gold/20 text-gold',
        blush: 'border-transparent bg-blush/20 text-blush',
        success: 'border-transparent bg-emerald-500/20 text-emerald-400',
        warning: 'border-transparent bg-amber-500/20 text-amber-400',
        info: 'border-transparent bg-blue-500/20 text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
