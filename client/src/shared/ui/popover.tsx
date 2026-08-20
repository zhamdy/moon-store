import * as React from 'react';
import {
  Popover as HeroUIPopover,
  PopoverTrigger as HeroUIPopoverTrigger,
  PopoverContent as HeroUIPopoverContent,
} from '@heroui/react';
import { cn } from '@/shared/lib/utils';

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  children?: React.ReactNode;
}

const Popover: React.FC<PopoverProps> = ({ open, defaultOpen, onOpenChange, children }) => {
  return (
    <HeroUIPopover
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      placement="bottom"
    >
      {children}
    </HeroUIPopover>
  );
};

const PopoverTrigger = HeroUIPopoverTrigger;

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, children, ...props }, _ref) => (
    <HeroUIPopoverContent
      className={cn(
        'z-50 w-72 rounded-md border border-card-border bg-card p-4 text-foreground shadow-md outline-none',
        className
      )}
      {...props}
    >
      {children}
    </HeroUIPopoverContent>
  )
);
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverContent };
