import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { FormApi } from '@tanstack/react-form';
import { describe, expect, it } from 'vitest';
import { firstInvalidField, fieldErrorKey } from '../utils/field-errors';
import {
  CHECKOUT_FIELDS,
  EMPTY_CHECKOUT_VALUES,
  checkoutFieldError,
  checkoutFormSchema,
  type CheckoutFormValues,
} from './checkout-form';

const VALID: CheckoutFormValues = {
  fullName: 'Nour Hassan',
  phone: '01001112233',
  email: '',
  governorate: 'Cairo',
  area: 'Zamalek',
  street: '26th of July St, building 12',
  apartment: '',
  landmark: '',
};

function issuesFor(values: CheckoutFormValues) {
  const result = checkoutFormSchema['~standard'].validate(values);
  if (result instanceof Promise) throw new Error('schema must be synchronous');
  return (result.issues ?? []).map((issue) => [issue.path?.[0], issue.message]);
}

describe('checkoutFieldError', () => {
  it('accepts a complete draft with the optional fields empty', () => {
    for (const field of CHECKOUT_FIELDS) {
      expect(checkoutFieldError(field, VALID[field])).toBeNull();
    }
  });

  it('requires name, phone, governorate, area and street, trimming whitespace', () => {
    expect(checkoutFieldError('fullName', '   ')).toBe('required');
    expect(checkoutFieldError('phone', '')).toBe('required');
    expect(checkoutFieldError('governorate', ' ')).toBe('required');
    expect(checkoutFieldError('area', '')).toBe('required');
    expect(checkoutFieldError('street', '')).toBe('required');
    expect(checkoutFieldError('email', '')).toBeNull();
    expect(checkoutFieldError('apartment', '  ')).toBeNull();
    expect(checkoutFieldError('landmark', '')).toBeNull();
  });

  it('enforces lengths at the boundary', () => {
    expect(checkoutFieldError('fullName', 'a'.repeat(100))).toBeNull();
    expect(checkoutFieldError('fullName', 'a'.repeat(101))).toBe('tooLong');
    expect(checkoutFieldError('street', 'a'.repeat(150))).toBeNull();
    expect(checkoutFieldError('street', 'a'.repeat(151))).toBe('tooLong');
    expect(checkoutFieldError('area', 'a'.repeat(51))).toBe('tooLong');
    expect(checkoutFieldError('governorate', 'a'.repeat(51))).toBe('tooLong');
    expect(checkoutFieldError('email', `${'a'.repeat(250)}@b.co`)).toBe('tooLong');
  });

  it('governorate is free text: any name passes, since no coverage list exists', () => {
    expect(checkoutFieldError('governorate', 'Cairo')).toBeNull();
    expect(checkoutFieldError('governorate', 'القاهرة')).toBeNull();
  });

  it('checks phone and email shape', () => {
    expect(checkoutFieldError('phone', 'abc')).toBe('phoneInvalid');
    expect(checkoutFieldError('phone', '1234567')).toBe('phoneInvalid');
    expect(checkoutFieldError('phone', '+20 100 111 2233')).toBeNull();
    expect(checkoutFieldError('phone', '٠١٠٠١١١٢٢٣٣')).toBeNull();
    expect(checkoutFieldError('email', 'a@')).toBe('emailInvalid');
    expect(checkoutFieldError('email', 'nour @moon.com')).toBe('emailInvalid');
    expect(checkoutFieldError('email', 'nour@moon.com')).toBeNull();
  });
});

describe('checkoutFormSchema (Standard Schema)', () => {
  it('passes a valid draft and reports each broken field once, keyed', () => {
    expect(issuesFor(VALID)).toEqual([]);
    expect(issuesFor({ ...VALID, phone: '123', email: 'x' })).toEqual([
      ['phone', 'phoneInvalid'],
      ['email', 'emailInvalid'],
    ]);
  });

  it('through TanStack FormApi: empty submit errors exactly the required fields', async () => {
    const form = new FormApi({
      defaultValues: EMPTY_CHECKOUT_VALUES,
      validators: { onSubmit: checkoutFormSchema },
    });
    form.mount();
    await form.handleSubmit();

    const errors = Object.fromEntries(
      CHECKOUT_FIELDS.map((field) => [field, fieldErrorKey(form.getFieldMeta(field)?.errors)])
    );
    expect(errors).toEqual({
      fullName: 'required',
      phone: 'required',
      email: null,
      governorate: 'required',
      area: 'required',
      street: 'required',
      apartment: null,
      landmark: null,
    });
    expect(
      firstInvalidField(
        Object.fromEntries(
          CHECKOUT_FIELDS.map((field) => [field, form.getFieldMeta(field)?.errors])
        )
      )
    ).toBe('fullName');
  });

  it('through TanStack FormApi: a valid draft submits', async () => {
    let submitted: CheckoutFormValues | null = null;
    const form = new FormApi({
      defaultValues: VALID,
      validators: { onSubmit: checkoutFormSchema },
      onSubmit: ({ value }) => {
        submitted = value;
      },
    });
    form.mount();
    await form.handleSubmit();
    expect(submitted).toEqual(VALID);
  });
});

describe('Zod stays in the checkout slice', () => {
  it('no storefront file outside features/checkout imports zod', () => {
    const root = path.resolve(__dirname, '../../..');
    const skip = new Set(['node_modules', '.next', 'checkout']);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (skip.has(entry) && !(entry === 'checkout' && !dir.endsWith('features'))) continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry) && /from ['"]zod/.test(readFileSync(full, 'utf8'))) {
          offenders.push(path.relative(root, full));
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
