import type {
  ReactNode,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
} from 'react';
import type { FieldError } from 'react-hook-form';

export interface BaseFieldProps {
  id?: string;
  name?: string;
  label?: ReactNode;
  helperText?: ReactNode;
  errorMessage?: ReactNode | FieldError;
  isRequired?: boolean;
  isInvalid?: boolean;
  isDisabled?: boolean;
  className?: string;
  children?: ReactNode;
}

export interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  helperText?: ReactNode;
  errorMessage?: ReactNode | FieldError;
  isRequired?: boolean;
  isInvalid?: boolean;
  startContent?: ReactNode;
  endContent?: ReactNode;
  isClearable?: boolean;
  onClear?: () => void;
  variant?: 'bordered' | 'flat' | 'underlined';
  inputSize?: 'sm' | 'md' | 'lg';
}

export interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  helperText?: ReactNode;
  errorMessage?: ReactNode | FieldError;
  isRequired?: boolean;
  isInvalid?: boolean;
  variant?: 'bordered' | 'flat' | 'underlined';
  inputSize?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  maxLength?: number;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode;
  helperText?: ReactNode;
  errorMessage?: ReactNode | FieldError;
  isRequired?: boolean;
  isInvalid?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  variant?: 'bordered' | 'flat' | 'underlined';
  inputSize?: 'sm' | 'md' | 'lg';
}

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  label?: ReactNode;
  helperText?: ReactNode;
  errorMessage?: ReactNode;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  className?: string;
}

export interface UploadedFile {
  id: string;
  file?: File;
  url: string;
  name: string;
  size?: number;
}

export interface ImageUploaderProps {
  value?: string | string[] | UploadedFile[];
  onChange?: (files: UploadedFile[]) => void;
  onUpload?: (file: File) => Promise<string>;
  maxFiles?: number;
  accept?: string;
  maxSizeBytes?: number;
  label?: ReactNode;
  helperText?: ReactNode;
  errorMessage?: ReactNode;
  isInvalid?: boolean;
  isDisabled?: boolean;
  className?: string;
}
