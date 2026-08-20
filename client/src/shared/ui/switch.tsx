import * as React from 'react';
import { Switch as HeroUISwitch } from '@heroui/react';
import { cn } from '@/shared/lib/utils';

export interface SwitchProps extends Omit<React.HTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  required?: boolean;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    { className, checked, defaultChecked, onCheckedChange, disabled, 'aria-label': ariaLabel },
    ref
  ) => (
    <HeroUISwitch
      ref={ref}
      isSelected={checked}
      defaultSelected={defaultChecked}
      onValueChange={onCheckedChange}
      isDisabled={disabled}
      aria-label={ariaLabel}
      classNames={{
        base: cn('inline-flex items-center cursor-pointer m-0', className),
        wrapper:
          'group-data-[selected=true]:bg-gold bg-muted/40 transition-colors h-6 w-11 p-0.5 rounded-full',
        thumb: 'bg-background w-5 h-5 group-data-[selected=true]:ms-5',
      }}
    />
  )
);
Switch.displayName = 'Switch';

export { Switch };
