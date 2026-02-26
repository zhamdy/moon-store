import { cn } from '@/lib/utils';

const variantClasses = {
  default: '',
  text: 'h-4 w-3/4',
  circle: 'h-10 w-10 rounded-full',
  chart: 'h-[300px] w-full',
} as const;

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variantClasses;
}

function Skeleton({ className, variant = 'default', ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-shimmer rounded-md', variantClasses[variant], className)}
      {...props}
    />
  );
}

export { Skeleton };
