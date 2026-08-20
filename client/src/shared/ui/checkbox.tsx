import * as React from 'react';
import { Checkbox as HeroUICheckbox } from '@heroui/react';
import { cn } from '@/shared/lib/utils';

export interface CheckboxProps extends Omit<
  React.HTMLAttributes<HTMLInputElement>,
  'onChange' | 'defaultChecked'
> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  required?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, checked, defaultChecked, onCheckedChange, disabled, 'aria-label': ariaLabel },
    ref
  ) => (
    <HeroUICheckbox
      ref={ref}
      isSelected={checked}
      defaultSelected={defaultChecked}
      onValueChange={onCheckedChange}
      isDisabled={disabled}
      aria-label={ariaLabel}
      classNames={{
        base: cn('p-0 m-0', className),
        wrapper:
          'before:border-gold group-data-[selected=true]:bg-gold rounded-sm w-4 h-4 after:bg-gold',
        icon: 'text-primary-foreground w-3 h-3',
      }}
    />
  )
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
