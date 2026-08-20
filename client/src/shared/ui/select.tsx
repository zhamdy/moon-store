import * as React from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedLabel: React.ReactNode;
  registerItem: (value: string, label: React.ReactNode) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({
  value,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}) => {
  const [internalValue, setInternalValue] = React.useState<string>(value || defaultValue || '');
  const [internalOpen, setInternalOpen] = React.useState<boolean>(defaultOpen);
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>({});

  const isControlledOpen = controlledOpen !== undefined;
  const isOpen = isControlledOpen ? controlledOpen : internalOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlledOpen) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlledOpen, onOpenChange]
  );

  const currentValue = value !== undefined ? value : internalValue;

  const handleValueChange = React.useCallback(
    (val: string) => {
      setInternalValue(val);
      onValueChange?.(val);
      setOpen(false);
    },
    [onValueChange, setOpen]
  );

  const registerItem = React.useCallback((val: string, label: React.ReactNode) => {
    setLabels((prev) => (prev[val] === label ? prev : { ...prev, [val]: label }));
  }, []);

  const contextValue = React.useMemo<SelectContextValue>(
    () => ({
      value: currentValue,
      onValueChange: handleValueChange,
      open: isOpen,
      setOpen,
      selectedLabel: labels[currentValue],
      registerItem,
    }),
    [currentValue, handleValueChange, isOpen, setOpen, labels, registerItem]
  );

  return (
    <SelectContext.Provider value={contextValue}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
};

const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-1', className)} {...props} />
);
SelectGroup.displayName = 'SelectGroup';

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder, children, ...props }, ref) => {
    const ctx = React.useContext(SelectContext);
    const content = children || ctx?.selectedLabel || ctx?.value || placeholder;

    return (
      <span ref={ref} className={cn('truncate', !ctx?.value && 'text-muted', className)} {...props}>
        {content}
      </span>
    );
  }
);
SelectValue.displayName = 'SelectValue';

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, disabled, role = 'combobox', onClick, onPointerDown, ...props }, ref) => {
  const ctx = React.useContext(SelectContext);

  return (
    <button
      ref={ref}
      type="button"
      role={role}
      aria-haspopup="listbox"
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (!disabled) ctx?.setOpen(!ctx.open);
      }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (!disabled) ctx?.setOpen(!ctx.open);
      }}
      aria-expanded={ctx?.open}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 font-data',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 text-gold opacity-50 ms-2 shrink-0" />
    </button>
  );
});
SelectTrigger.displayName = 'SelectTrigger';

const SelectScrollUpButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUp className="h-4 w-4 text-gold" />
    </div>
  )
);
SelectScrollUpButton.displayName = 'SelectScrollUpButton';

const SelectScrollDownButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4 text-gold" />
  </div>
));
SelectScrollDownButton.displayName = 'SelectScrollDownButton';

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: 'popper' | 'item-aligned';
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(SelectContext);
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
          ctx?.setOpen(false);
        }
      };

      if (ctx?.open) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [ctx]);

    if (!ctx?.open) return null;

    return (
      <div
        ref={contentRef}
        className={cn(
          'absolute start-0 top-[calc(100%+4px)] z-50 max-h-96 min-w-[8rem] w-full overflow-y-auto rounded-md border border-card-border bg-card p-1 text-foreground shadow-md font-sans',
          className
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <div ref={ref} className="p-1">
          {children}
        </div>
        <SelectScrollDownButton />
      </div>
    );
  }
);
SelectContent.displayName = 'SelectContent';

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('py-1.5 ps-8 pe-2 text-sm font-semibold text-gold', className)}
      {...props}
    />
  )
);
SelectLabel.displayName = 'SelectLabel';

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, disabled, ...props }, ref) => {
    const ctx = React.useContext(SelectContext);
    const isSelected = ctx?.value === value;

    React.useEffect(() => {
      ctx?.registerItem(value, children);
    }, [value, children, ctx]);

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        onClick={() => !disabled && ctx?.onValueChange?.(value)}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 ps-8 pe-2 text-sm outline-none transition-colors hover:bg-surface hover:text-gold data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          isSelected && 'bg-surface text-gold font-medium',
          disabled && 'pointer-events-none opacity-50',
          className
        )}
        {...props}
      >
        {isSelected && (
          <span className="absolute start-2 flex h-3.5 w-3.5 items-center justify-center">
            <Check className="h-4 w-4 text-gold" />
          </span>
        )}
        <span>{children}</span>
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';

const SelectSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
  )
);
SelectSeparator.displayName = 'SelectSeparator';

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
