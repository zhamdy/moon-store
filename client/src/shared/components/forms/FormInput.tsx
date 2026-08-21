import React, { forwardRef } from 'react';
import { X } from 'lucide-react';
import { FormField } from './FormField';
import type { FormInputProps } from './types';

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

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(function FormInput(
  {
    id,
    name,
    label,
    helperText,
    errorMessage,
    isRequired,
    isInvalid,
    disabled,
    className = '',
    startContent,
    endContent,
    isClearable,
    onClear,
    value,
    defaultValue,
    variant = 'bordered',
    inputSize = 'md',
    ...props
  },
  ref
) {
  const hasError = Boolean(isInvalid || errorMessage);
  const isControlled = value !== undefined;
  const hasValue = isControlled ? Boolean(value) : Boolean(defaultValue);

  const inputElement = (
    <div
      className={`relative flex items-center transition-colors ${variantClasses[variant]} ${
        hasError ? '!border-danger !ring-danger/20' : ''
      } ${disabled ? 'opacity-60 cursor-not-allowed bg-muted/30' : ''}`}
    >
      {startContent && (
        <div className="ps-3 pe-1 flex items-center text-muted-foreground select-none pointer-events-none">
          {startContent}
        </div>
      )}

      <input
        ref={ref}
        id={id}
        name={name}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        className={`w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none font-normal ${
          sizeClasses[inputSize]
        } ${startContent ? '!ps-1' : ''} ${endContent || isClearable ? '!pe-1' : ''} ${className}`}
        {...props}
      />

      {isClearable && hasValue && !disabled && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear input"
          className="p-1 me-1 text-muted-foreground hover:text-foreground rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {endContent && (
        <div className="pe-3 ps-1 flex items-center text-muted-foreground select-none pointer-events-none">
          {endContent}
        </div>
      )}
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
        {inputElement}
      </FormField>
    );
  }

  return inputElement;
});

FormInput.displayName = 'FormInput';

export default FormInput;
