import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import { CHECKOUT_ERROR_KEYS, CHECKOUT_FIELDS } from '../schemas/checkout-form';

const LOCALES = [
  ['en', en.checkout],
  ['ar', ar.checkout],
] as const;

describe('checkout messages', () => {
  it.each(LOCALES)('%s: every error key the schema can emit has a message', (_locale, messages) => {
    for (const key of CHECKOUT_ERROR_KEYS) {
      expect((messages.errors as Record<string, string>)[key]).toBeTruthy();
    }
    expect(messages.errors.tooLong).toContain('{max}');
  });

  it.each(LOCALES)('%s: every field has a label', (_locale, messages) => {
    for (const field of CHECKOUT_FIELDS) {
      expect((messages.fields as Record<string, string>)[field]).toBeTruthy();
    }
  });

  // Owner decision 2026-09-15: delivery wording stays neutral until real delivery rules exist.
  it.each(LOCALES)('%s: delivery copy promises no fee, courier, timing or coverage', (_l, m) => {
    const copy = `${m.delivery.pending} ${m.summary.deliveryLater}`;
    expect(copy).not.toMatch(/[0-9٠-٩]/);
    expect(copy).not.toMatch(
      /EGP|ج\.م|fee|free|cost|courier|shipping company|day|hour|week|today|tomorrow|everywhere|all governorates|رسوم|مجان|شركة شحن|يوم|أيام|ساعة|أسبوع|اليوم|غدًا|غدا|كل المحافظات/i
    );
  });

  it.each(LOCALES)('%s: the outcome copy is the preview key, not a production key', (_l, m) => {
    expect(Object.keys(m.outcome)).toContain('unavailablePreview');
    expect(Object.keys(m.outcome)).not.toContain('unavailable');
  });
});
