import React, { cloneElement, isValidElement, type ReactElement } from 'react';
import { useFormFieldIds } from '../../lib/idUtils';
import type { BaseFieldProps } from './types';

export interface FormFieldProps extends BaseFieldProps {
  // If true, will clone child element and inject aria attributes & id
  passPropsToChild?: boolean;
}

export function FormField({
  id,
  label,
  helperText,
  errorMessage,
  isRequired = false,
  isInvalid = false,
  isDisabled = false,
  className = '',
  passPropsToChild = true,
  children,
}: FormFieldProps): React.JSX.Element {
  const ids = useFormFieldIds(id);
  const errorText: React.ReactNode =
    typeof errorMessage === 'object' && errorMessage !== null && 'message' in errorMessage
      ? (errorMessage.message ?? null)
      : (errorMessage as React.ReactNode);

  const hasError = Boolean(isInvalid || errorText);

  // Compute describedby IDs
  const describedByParts: string[] = [];
  if (hasError) {
    describedByParts.push(ids.errorId);
  } else if (helperText) {
    describedByParts.push(ids.helperId);
  }
  const ariaDescribedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  let renderedChild = children;
  if (passPropsToChild && isValidElement(children)) {
    const child = children as ReactElement<{
      id?: string;
      'aria-invalid'?: boolean;
      'aria-required'?: boolean;
      'aria-describedby'?: string;
      disabled?: boolean;
      isDisabled?: boolean;
    }>;
    renderedChild = cloneElement(child, {
      id: child.props.id || ids.inputId,
      'aria-invalid': hasError ? true : undefined,
      'aria-required': isRequired ? true : undefined,
      'aria-describedby': child.props['aria-describedby'] || ariaDescribedBy,
      disabled: child.props.disabled ?? (isDisabled ? true : undefined),
    });
  }

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label
          htmlFor={ids.inputId}
          id={ids.labelId}
          className={`text-sm font-medium transition-colors ${
            hasError
              ? 'text-danger'
              : isDisabled
                ? 'text-muted-foreground opacity-60'
                : 'text-foreground'
          }`}
        >
          {label}
          {isRequired && (
            <span className="text-danger ms-1 select-none" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {renderedChild}

      {hasError && errorText && (
        <p
          id={ids.errorId}
          role="alert"
          className="text-xs font-normal text-danger animate-in fade-in-50 duration-150"
        >
          {errorText}
        </p>
      )}

      {!hasError && helperText && (
        <p id={ids.helperId} className="text-xs font-normal text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  );
}

export default FormField;
