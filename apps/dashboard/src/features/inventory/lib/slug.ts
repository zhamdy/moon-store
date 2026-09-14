/**
 * Storefront slugs as the dashboard authors them (plan 2026-09-14-002, KD-6).
 *
 * The pattern and length mirror the server's Zod schema, which is the authority; checking
 * them here only moves the error next to the field before a round trip.
 */
import { z } from 'zod';
import { t } from '../../../shared/i18n/index';
import type { MutationFailure } from '../../../shared/lib/mutationError';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 80;

/**
 * The suggestion offered from an English name. Arabic is never transliterated: a name
 * with no ASCII letters or digits suggests nothing, and the server generates one instead.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
}

/** Form-side rule: blank is allowed (the server generates or keeps one). */
export const slugFormSchema = () =>
  z
    .string()
    .trim()
    .max(SLUG_MAX_LENGTH, t('catalog.slugInvalid'))
    .refine((value) => value === '' || SLUG_PATTERN.test(value), t('catalog.slugInvalid'))
    .optional();

/**
 * The server refuses an empty slug, so blank is omitted: "generate one" on create,
 * "leave it" on update. A published slug is renamed, never removed.
 */
export const slugForWrite = (value: string | null | undefined): string | undefined =>
  value?.trim() || undefined;

/** Blank English copy is sent as null, which clears the stored value on update. */
export const englishForWrite = (value: string | null | undefined): string | null =>
  value?.trim() || null;

/**
 * The inline message for a write the server refused because of the slug, or null when
 * the failure is about something else and should take its usual path.
 */
export function slugFailureMessage(failure: MutationFailure): string | null {
  const detail = failure.details.find((d) => d.field === 'slug');
  if (!detail) return null;
  if (detail.code === 'SLUG_TAKEN') return t('catalog.slugTaken');
  if (detail.code === 'SLUG_UNAVAILABLE') return t('catalog.slugUnavailable');
  return t('catalog.slugInvalid');
}
