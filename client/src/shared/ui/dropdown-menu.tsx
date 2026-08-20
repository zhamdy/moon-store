import * as React from 'react';
import {
  Dropdown as HeroUIDropdown,
  DropdownTrigger as HeroUIDropdownTrigger,
  DropdownMenu as HeroUIDropdownMenu,
  DropdownItem as HeroUIDropdownItem,
  DropdownSection as HeroUIDropdownSection,
} from '@heroui/react';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface DropdownMenuProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  open,
  defaultOpen,
  onOpenChange,
  children,
}) => {
  return (
    <HeroUIDropdown isOpen={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {children}
    </HeroUIDropdown>
  );
};

const DropdownMenuTrigger = HeroUIDropdownTrigger;
const DropdownMenuGroup = HeroUIDropdownSection;
const DropdownMenuPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
const DropdownMenuSub: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-surface',
      inset && 'ps-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ms-auto h-4 w-4 text-gold" />
  </div>
));
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-md border border-card-border bg-card p-1 text-foreground shadow-lg',
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLUListElement> {
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
}

const DropdownMenuContent = React.forwardRef<HTMLUListElement, DropdownMenuContentProps>(
  ({ className, children, ...props }, _ref) => (
    <HeroUIDropdownMenu
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border border-card-border bg-card p-1 text-foreground shadow-md',
        className
      )}
      {...props}
    >
      {children as React.ReactElement}
    </HeroUIDropdownMenu>
  )
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLLIElement> {
  inset?: boolean;
  disabled?: boolean;
  onSelect?: (e: React.SyntheticEvent) => void;
}

const DropdownMenuItem = React.forwardRef<HTMLLIElement, DropdownMenuItemProps>(
  ({ className, inset, children, disabled, onSelect, onClick, ...props }, _ref) => (
    <HeroUIDropdownItem
      isDisabled={disabled}
      onPress={(e) => {
        onClick?.(e as unknown as React.MouseEvent<HTMLLIElement>);
        onSelect?.(e as unknown as React.SyntheticEvent);
      }}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-surface hover:text-gold data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
        inset && 'ps-8',
        className
      )}
      {...props}
    >
      {children}
    </HeroUIDropdownItem>
  )
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export interface DropdownMenuCheckboxItemProps extends React.HTMLAttributes<HTMLLIElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

const DropdownMenuCheckboxItem = React.forwardRef<HTMLLIElement, DropdownMenuCheckboxItemProps>(
  ({ className, children, checked, onCheckedChange, disabled, ...props }, _ref) => (
    <HeroUIDropdownItem
      isDisabled={disabled}
      onPress={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 ps-8 pe-2 text-sm outline-none transition-colors hover:bg-surface hover:text-gold data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
        className
      )}
      {...props}
    >
      {checked && (
        <span className="absolute start-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4 text-gold" />
        </span>
      )}
      {children}
    </HeroUIDropdownItem>
  )
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export interface DropdownMenuRadioItemProps extends React.HTMLAttributes<HTMLLIElement> {
  value?: string;
  checked?: boolean;
  disabled?: boolean;
}

const DropdownMenuRadioItem = React.forwardRef<HTMLLIElement, DropdownMenuRadioItemProps>(
  ({ className, children, checked, disabled, ...props }, _ref) => (
    <HeroUIDropdownItem
      isDisabled={disabled}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 ps-8 pe-2 text-sm outline-none transition-colors hover:bg-surface hover:text-gold data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
        className
      )}
      {...props}
    >
      {checked && (
        <span className="absolute start-2 flex h-3.5 w-3.5 items-center justify-center">
          <Circle className="h-2 w-2 fill-current text-gold" />
        </span>
      )}
      {children}
    </HeroUIDropdownItem>
  )
);
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-2 py-1.5 text-sm font-semibold text-gold', inset && 'ps-8', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('ms-auto text-xs tracking-widest text-muted', className)} {...props} />
);
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

const DropdownMenuRadioGroup: React.FC<{
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}> = ({ children }) => <>{children}</>;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
