import React, { forwardRef, useState } from 'react';
import { FormField } from './FormField';
import type { FormTextareaProps } from './types';

const variantClasses = {
  bordered:
    'border border-border bg-background hover:border-foreground/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
  flat: 'border-transparent bg-muted/60 hover:bg-muted focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary',
  underlined:
    'border-b-2 border-border bg-transparent rounded-none px-0 hover:border-foreground/40 focus-within:border-primary',
};

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  function FormTextarea(
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
      variant = 'bordered',
      showCount = false,
      maxLength,
      value,
      defaultValue,
      onChange,
      rows = 3,
      ...props
    },
    ref
  ) {
    const [charCount, setCharCount] = useState<number>(() => {
      if (typeof value === 'string') return value.length;
      if (typeof defaultValue === 'string') return defaultValue.length;
      return 0;
    });

    const hasError = Boolean(isInvalid || errorMessage);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      if (onChange) onChange(e);
    };

    const textareaElement = (
      <div
        className={`relative flex flex-col transition-colors rounded-lg ${
          variantClasses[variant]
        } ${hasError ? '!border-danger !ring-danger/20' : ''} ${
          disabled ? 'opacity-60 cursor-not-allowed bg-muted/30' : ''
        }`}
      >
        <textarea
          ref={ref}
          id={id}
          name={name}
          rows={rows}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          maxLength={maxLength}
          onChange={handleChange}
          className={`w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none font-normal p-3 resize-y ${className}`}
          {...props}
        />

        {showCount && maxLength && (
          <div className="flex justify-end px-3 pb-2 text-[11px] text-muted-foreground font-mono select-none">
            {charCount}/{maxLength}
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
          {textareaElement}
        </FormField>
      );
    }

    return textareaElement;
  }
);

FormTextarea.displayName = 'FormTextarea';

export default FormTextarea;
