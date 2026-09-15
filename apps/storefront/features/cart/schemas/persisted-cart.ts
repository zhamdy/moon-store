import * as z from 'zod/v4/mini';
import {
  CART_VERSION,
  MAX_LINE_OPTIONS,
  MAX_LINE_QUANTITY,
  MAX_OPTION_KEY_LENGTH,
  MAX_OPTION_VALUE_LENGTH,
  MAX_SLUG_LENGTH,
} from '../constants';

/**
 * The persisted bag, v1. `zod/v4/mini` rather than full Zod because this module is eager on
 * every page through the header badge (CD-10). Unknown keys are stripped, so a line that
 * somehow carries `price` or `name` is rewritten without them and never read.
 */

/** Mirrors the server's public slug pattern; the storefront cannot import it. */
export const CART_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const persistedCartLineSchema = z.object({
  slug: z.string().check(z.minLength(1), z.maxLength(MAX_SLUG_LENGTH), z.regex(CART_SLUG_PATTERN)),
  options: z
    .record(
      z.string().check(z.minLength(1), z.maxLength(MAX_OPTION_KEY_LENGTH)),
      z.string().check(z.minLength(1), z.maxLength(MAX_OPTION_VALUE_LENGTH))
    )
    .check(z.refine((options) => Object.keys(options).length <= MAX_LINE_OPTIONS)),
  quantity: z.int().check(z.gte(1), z.lte(MAX_LINE_QUANTITY)),
});

/**
 * The envelope only: lines are validated one by one by the reader, so one bad line drops
 * that line rather than the whole bag.
 */
export const persistedCartEnvelopeSchema = z.object({
  version: z.number(),
  lines: z.array(z.unknown()),
});

export type PersistedCartLine = z.infer<typeof persistedCartLineSchema>;

export interface PersistedCart {
  version: typeof CART_VERSION;
  lines: PersistedCartLine[];
}
