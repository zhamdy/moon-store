import {
  CART_VERSION,
  MAX_LINE_OPTIONS,
  MAX_LINE_QUANTITY,
  MAX_OPTION_KEY_LENGTH,
  MAX_OPTION_VALUE_LENGTH,
  MAX_SLUG_LENGTH,
} from '../constants';

/**
 * The persisted bag, v1, as a hand-written guard. This module is eager on every page through
 * the header badge (CD-10), and `zod/v4/mini` alone measured ~8 KB gz against a +5 KB budget
 * for the whole store, so the plan's fallback applies: no schema library here.
 *
 * Every accepted value is freshly built from the fields it names, so a line carrying `price`
 * or `name` is rewritten without them and never read. Only `typeof` checks: `"2"`, `1.5`,
 * `NaN` and `Infinity` are not quantities.
 */

/** Mirrors the server's public slug pattern; the storefront cannot import it. */
export const CART_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Keys that could reach `Object.prototype` through a later assignment or be mistaken for
 * inherited members. No product option is spelled like this, so the line is dropped.
 */
const RESERVED_OPTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface PersistedCartLine {
  slug: string;
  options: Record<string, string>;
  quantity: number;
}

export interface PersistedCart {
  version: typeof CART_VERSION;
  lines: PersistedCartLine[];
}

/** The envelope only: the reader judges lines one by one, so one bad line drops that line. */
export interface PersistedCartEnvelope {
  version: number;
  lines: unknown[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= max;
}

function parseOptions(value: unknown): Record<string, string> | null {
  if (!isPlainObject(value)) {
    return null;
  }
  // Own enumerable string keys only; symbols and inherited members are never read.
  const keys = Object.keys(value);
  if (keys.length > MAX_LINE_OPTIONS) {
    return null;
  }
  const options: Record<string, string> = {};
  for (const key of keys) {
    if (!isBoundedString(key, MAX_OPTION_KEY_LENGTH) || RESERVED_OPTION_KEYS.has(key)) {
      return null;
    }
    const optionValue = value[key];
    if (!isBoundedString(optionValue, MAX_OPTION_VALUE_LENGTH)) {
      return null;
    }
    options[key] = optionValue;
  }
  return options;
}

/** A valid v1 line, freshly built, or `null`. */
export function parsePersistedCartLine(value: unknown): PersistedCartLine | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const { slug, quantity } = value;
  if (!isBoundedString(slug, MAX_SLUG_LENGTH) || !CART_SLUG_PATTERN.test(slug)) {
    return null;
  }
  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_LINE_QUANTITY
  ) {
    return null;
  }
  const options = parseOptions(value.options);
  return options ? { slug, options, quantity } : null;
}

/** `{ version: number, lines: unknown[] }` or `null`; the version is compared by the reader. */
export function parsePersistedCartEnvelope(value: unknown): PersistedCartEnvelope | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const { version, lines } = value;
  if (typeof version !== 'number' || !Array.isArray(lines)) {
    return null;
  }
  return { version, lines };
}
