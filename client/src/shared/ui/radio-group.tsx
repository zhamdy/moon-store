import * as React from 'react';
import { RadioGroup as HeroUIRadioGroup, Radio as HeroUIRadio } from '@heroui/react';
import { cn } from '@/shared/lib/utils';

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, defaultValue, onValueChange, disabled, children, ...props }, ref) => {
    return (
      <HeroUIRadioGroup
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        isDisabled={disabled}
        className={cn('grid gap-2', className)}
        {...props}
      >
        {children}
      </HeroUIRadioGroup>
    );
  }
);
RadioGroup.displayName = 'RadioGroup';

export interface RadioGroupItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, disabled, children, ...props }, ref) => {
    return (
      <HeroUIRadio
        ref={ref}
        value={value}
        isDisabled={disabled}
        classNames={{
          base: cn('m-0', className),
          wrapper:
            'border-gold group-data-[selected=true]:border-gold group-data-[selected=true]:bg-gold',
          control: 'bg-primary-foreground',
        }}
        {...props}
      >
        {children}
      </HeroUIRadio>
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
