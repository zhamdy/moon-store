import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { FormField } from './FormField';
import type { FormSelectProps } from './types';

const sizeClasses = {
  sm: 'h-8 text-xs px-2.5 rounded-md',
  md: 'h-10 text-sm px-3 rounded-lg',
  lg: 'h-12 text-base px-4 rounded-xl',
};

const variantClasses = {
  bordered:
    'border border-border bg-background hover:border-foreground/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
  flat: 'border-transparent bg-muted/60 hover:bg-muted focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary',
  underlined:
    'border-b-2 border-border bg-transparent rounded-none px-0 hover:border-foreground/40 focus-within:border-primary',
};

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(function FormSelect(
  {
    id,
    name,
    label,
    helperText,
    errorMessage,
    isRequired,
    isInvalid,
    disabled,
    options = [],
    placeholder,
    className = '',
    variant = 'bordered',
    inputSize = 'md',
    children,
    ...props
  },
  ref
) {
  const hasError = Boolean(isInvalid || errorMessage);

  const selectElement = (
    <div
      className={`relative flex items-center transition-colors ${variantClasses[variant]} ${
        hasError ? '!border-danger !ring-danger/20' : ''
      } ${disabled ? 'opacity-60 cursor-not-allowed bg-muted/30' : ''}`}
    >
      <select
        ref={ref}
        id={id}
        name={name}
        disabled={disabled}
        className={`w-full bg-transparent text-foreground outline-none font-normal appearance-none cursor-pointer pe-8 ${
          sizeClasses[inputSize]
        } ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-muted-foreground bg-background">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            className="bg-background text-foreground"
          >
            {opt.label}
          </option>
        ))}
        {children}
      </select>

      <div className="pointer-events-none absolute end-2.5 flex items-center text-muted-foreground">
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
  );

  if (label || helperText || errorMessage) {
    return (
      <FormField
        id={id}
        label={label}
        helperText={helperText}
        errorMessage={errorMessage}
        isRequired={isRequired}
        isInvalid={hasError}
        isDisabled={disabled}
        passPropsToChild={false}
      >
        {selectElement}
      </FormField>
    );
  }

  return selectElement;
});

FormSelect.displayName = 'FormSelect';

export default FormSelect;
