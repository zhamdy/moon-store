import { useId } from 'react';

export interface FormFieldIds {
  id: string;
  inputId: string;
  labelId: string;
  helperId: string;
  errorId: string;
  descriptionId: string;
}

export function getFormFieldIds(baseId: string): FormFieldIds {
  return {
    id: baseId,
    inputId: baseId,
    labelId: `${baseId}-label`,
    helperId: `${baseId}-helper`,
    errorId: `${baseId}-error`,
    descriptionId: `${baseId}-description`,
  };
}

export function useFormFieldIds(providedId?: string, prefix = 'field'): FormFieldIds {
  const generatedId = useId();
  const baseId = providedId || `${prefix}-${generatedId.replace(/:/g, '')}`;
  return getFormFieldIds(baseId);
}

let counter = 0;
export function generateUniqueId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${counter}-${Date.now().toString(36)}`;
}
