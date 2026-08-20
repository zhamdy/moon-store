import * as React from 'react';
import { Skeleton as HeroUISkeleton } from '@heroui/react';
import { cn } from '@/shared/lib/utils';

const variantClasses = {
  default: '',
  text: 'h-4 w-3/4',
  circle: 'h-10 w-10 rounded-full',
  chart: 'h-[300px] w-full',
} as const;

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variantClasses;
  isLoaded?: boolean;
}

function Skeleton({ className, variant = 'default', isLoaded, children, ...props }: SkeletonProps) {
  return (
    <HeroUISkeleton
      isLoaded={isLoaded}
      className={cn('rounded-md', variantClasses[variant], className)}
      {...props}
    >
      {children}
    </HeroUISkeleton>
  );
}

export { Skeleton };
