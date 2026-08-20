import * as React from 'react';
import { Tooltip as HeroUITooltip } from '@heroui/react';
import { cn } from '@/shared/lib/utils';

const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

export interface TooltipProps {
  children?: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  let triggerChild: React.ReactElement | null = null;
  let contentChild: React.ReactNode = null;

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      if (child.type === TooltipTrigger) {
        triggerChild = child.props.children;
      } else if (child.type === TooltipContent) {
        contentChild = child.props.children;
      }
    }
  });

  if (triggerChild && contentChild) {
    return (
      <HeroUITooltip
        content={contentChild}
        placement="top"
        classNames={{
          content:
            'rounded-md border border-card-border bg-card px-3 py-1.5 text-sm text-foreground shadow-md',
        }}
      >
        {triggerChild}
      </HeroUITooltip>
    );
  }

  return <>{children}</>;
};

const TooltipTrigger: React.FC<{ asChild?: boolean; children: React.ReactNode }> = ({
  children,
}) => <>{children}</>;

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  sideOffset?: number;
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'z-50 overflow-hidden rounded-md border border-card-border bg-card px-3 py-1.5 text-sm text-foreground shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
