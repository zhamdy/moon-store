import { describe, expect, it } from 'vitest';
import { fieldErrorKey, firstInvalidField, focusPlan } from './field-errors';

describe('fieldErrorKey', () => {
  it('reads the first issue message or string as a known key', () => {
    expect(fieldErrorKey([{ message: 'phoneInvalid' }])).toBe('phoneInvalid');
    expect(fieldErrorKey(['tooLong'])).toBe('tooLong');
    expect(fieldErrorKey([undefined, { message: 'emailInvalid' }])).toBe('emailInvalid');
  });

  it('no errors is null; unknown text reads as required', () => {
    expect(fieldErrorKey(undefined)).toBeNull();
    expect(fieldErrorKey([])).toBeNull();
    expect(fieldErrorKey([{ message: 'Invalid input: expected string' }])).toBe('required');
    expect(fieldErrorKey([42])).toBe('required');
  });
});

describe('firstInvalidField', () => {
  it('follows DOM order, not the order errors arrive in', () => {
    expect(
      firstInvalidField({ street: [{ message: 'required' }], phone: [{ message: 'phoneInvalid' }] })
    ).toBe('phone');
    expect(firstInvalidField({ street: [{ message: 'required' }] })).toBe('street');
    expect(firstInvalidField({ fullName: [] })).toBeNull();
  });
});

describe('focusPlan', () => {
  it('refocuses a field that already has focus, so it is announced again', () => {
    expect(focusPlan(true)).toBe('refocus');
    expect(focusPlan(false)).toBe('focus');
  });
});
