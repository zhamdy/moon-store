import { z } from 'zod';
import { slugSchema } from '../src/modules/inventory/shared/slug';

export const productSchema = z.object({
  // Absent on create means "generate one"; absent on update means "leave it" (KD-6).
  slug: slugSchema.optional(),
  // Absent on update leaves the stored value; null clears it. Arabic `name` stays primary.
  name_en: z.string().max(255).nullable().optional(),
  name: z.string().min(1, 'Product name is required').max(255),
  // Same absent/null convention as `name_en`. Arabic `description` stays primary.
  description: z.string().max(5000).nullable().optional(),
  description_en: z.string().max(5000).nullable().optional(),
  // The storefront Details tab. Same absent/null convention; the unsuffixed field is Arabic.
  material: z.string().max(2000).nullable().optional(),
  material_en: z.string().max(2000).nullable().optional(),
  care: z.string().max(2000).nullable().optional(),
  care_en: z.string().max(2000).nullable().optional(),
  fit: z.string().max(2000).nullable().optional(),
  fit_en: z.string().max(2000).nullable().optional(),
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().max(100).optional().nullable(),
  price: z.number().positive('Price must be positive'),
  cost_price: z.number().min(0, 'Cost price cannot be negative').default(0),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  category: z.string().max(100).optional().nullable(),
  category_id: z.number().int().positive().optional().nullable(),
  distributor_id: z.number().int().positive().optional().nullable(),
  min_stock: z.number().int().min(0).default(5),
  status: z.enum(['active', 'inactive', 'discontinued']).default('active').optional(),
});

/**
 * The update body. Create and update disagree about what an **absent** field means, and
 * sharing one schema made absence destructive on update (HIGH-3 / MED-11 in
 * `docs/audits/2026-09-22-shop-cart-fullstack-audit.md`):
 *
 * - `stock` was required, so no caller could edit a name without also asserting an
 *   absolute stock. A form opened before a sale and saved after it silently resurrected
 *   the sold unit, with no `stock_adjustments` row — every edit was a lost-update window
 *   on inventory. Absent now keeps the stored value; an intentional change belongs on
 *   the audited adjust-stock path.
 * - `cost_price` and `min_stock` carried `.default()`, which is right on create and on
 *   update silently overwrote stored data with the default: a partial body reset a
 *   product's cost basis to 0, making every margin on it read as 100%.
 * - `barcode` and `distributor_id` were written as `x || null`, so omitting them cleared
 *   them; a wiped barcode makes the till's lookup 404.
 *
 * Everything else keeps full-replacement semantics, which the published contract has
 * always described.
 */
export const productUpdateSchema = productSchema.extend({
  stock: z.number().int().min(0, 'Stock cannot be negative').optional(),
  cost_price: z.number().min(0, 'Cost price cannot be negative').optional(),
  min_stock: z.number().int().min(0).optional(),
  /**
   * The `updated_at` the caller read, echoed back so a write composed against a stale
   * read is refused rather than silently overwriting what it missed (HIGH-3's
   * lost-update half). Same shape, token and posture as `PUT /collections/:id`'s
   * `expected_updated_at`.
   *
   * Optional on purpose: absent means the caller stakes no claim on the version and the
   * write behaves exactly as it did before, so an older client keeps working — the
   * compatibility posture the `Idempotency-Key` and collections rollouts both took.
   */
  expected_updated_at: z.string().optional(),
});

export const productImportSchema = z.array(productSchema);

export const variantSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().max(100).optional().nullable(),
  price: z.number().positive('Price must be positive').optional().nullable(),
  cost_price: z.number().min(0).default(0),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  attributes: z
    .record(z.string(), z.string())
    .refine((obj) => Object.keys(obj).length > 0, 'At least one attribute required'),
});

export const productStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'discontinued']),
});

export type Product = z.infer<typeof productSchema>;
export type ProductImport = z.infer<typeof productImportSchema>;
export type Variant = z.infer<typeof variantSchema>;
