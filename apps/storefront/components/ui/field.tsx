import type { ComponentPropsWithRef, ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Form primitives. Presentation only: they carry no state, no validation and no
 * wiring beyond what the caller passes, so a feature's form logic (TanStack Form on
 * checkout, the filter sheet's staged values) stays exactly where it is. The classes
 * (`.field-control`, `.field-frame`, `.field-input`, `.choice`) live in
 * app/globals.css so a feature can also apply them to its own element.
 *
 * Label above, 52px box, hint under the label, and an error row that is reserved so a
 * message never moves the fields below it. Errors are words with an icon — colour
 * never carries them alone — and are linked with `aria-describedby` by the caller.
 */

export function FieldLabel({
  optional,
  className,
  children,
  ...props
}: ComponentPropsWithRef<'label'> & { optional?: ReactNode }) {
  return (
    <label
      {...props}
      className={cn('type-field-label flex flex-wrap gap-x-2 text-text', className)}
    >
      {children}
      {optional && <span className="font-normal text-text-secondary">({optional})</span>}
    </label>
  );
}

export function FieldHint({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return <p {...props} className={cn('type-supporting text-text-secondary', className)} />;
}

/** The reserved error row: always rendered, empty until there is a message. */
export function FieldError({
  id,
  children,
  className,
}: {
  id?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-h-6 pt-2', className)}>
      {children ? (
        <p id={id} className="type-supporting flex items-start gap-2 font-medium text-danger">
          <CircleAlert
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-[3px] shrink-0"
          />
          <span>{children}</span>
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input {...props} className={cn('field-control', className)} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<'textarea'>) {
  return <textarea {...props} className={cn('field-control', className)} />;
}

export function Select({ className, ...props }: ComponentPropsWithRef<'select'>) {
  return <select {...props} className={cn('field-control', className)} />;
}

/** A checkbox or radio with its label, the whole row a 44px target. */
export function Choice({
  label,
  className,
  type = 'checkbox',
  ...props
}: Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  type?: 'checkbox' | 'radio';
  label: ReactNode;
}) {
  return (
    <label
      className={cn(
        'type-body flex min-h-(--size-tap) cursor-pointer items-center gap-3 text-text',
        className
      )}
    >
      <input {...props} type={type} className="choice" />
      {label}
    </label>
  );
}
