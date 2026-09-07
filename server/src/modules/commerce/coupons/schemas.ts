/**
 * The coupons module's request contracts (#102).
 *
 * The schemas moved out of the controller. A `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load, even where vitest does not care.
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { couponListQuerySchema } from './types';

export const couponSchema = z.object({
  code: z
    .string()
    .min(3, 'Coupon code must be at least 3 characters')
    .max(50)
    .transform((v) => v.toUpperCase().trim()),
  type: z.enum(['percentage', 'fixed'], {
    required_error: 'Type must be "percentage" or "fixed"',
  }),
  value: z.number().positive('Value must be positive'),
  min_purchase: z.number().min(0).optional().nullable(),
  max_discount: z.number().positive().optional().nullable(),
  starts_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  max_uses_per_customer: z.number().int().positive().optional().nullable(),
  scope: z.enum(['all', 'category', 'product']).default('all'),
  scope_ids: z.array(z.number().int().positive()).optional().nullable(),
  stackable: z.boolean().optional().default(false),
});

/**
 * The update body is a genuine partial — same reasoning as #78 on collections.
 *
 * The create schema is all-optional-with-defaults, and the repository wrote all twelve
 * columns from it, so the Promotions page — whose form has no field for
 * `max_uses_per_customer` or `scope_ids` — cleared a per-customer limit and a
 * category/product restriction on every edit. A coupon scoped to one category quietly
 * became valid on everything.
 *
 * No `.default()` here: a default turns "absent" back into "write this value".
 */
export const couponUpdateSchema = z.object({
  code: z
    .string()
    .min(3, 'Coupon code must be at least 3 characters')
    .max(50)
    .transform((v) => v.toUpperCase().trim())
    .optional(),
  type: z.enum(['percentage', 'fixed']).optional(),
  value: z.number().positive('Value must be positive').optional(),
  min_purchase: z.number().min(0).nullable().optional(),
  max_discount: z.number().positive().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  max_uses_per_customer: z.number().int().positive().nullable().optional(),
  scope: z.enum(['all', 'category', 'product']).optional(),
  scope_ids: z.array(z.number().int().positive()).nullable().optional(),
  stackable: z.boolean().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  subtotal: z.number().min(0, 'Subtotal must be non-negative'),
  customer_id: z.number().int().positive().optional().nullable(),
  item_product_ids: z.array(z.number().int().positive()).optional().nullable(),
});

export const couponsRequestContracts = {
  listCoupons: defineRequestContract({
    method: 'GET',
    path: '/api/v1/coupons',
    operation: 'listCoupons',
    query: couponListQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),

  createCoupon: defineRequestContract({
    method: 'POST',
    path: '/api/v1/coupons',
    operation: 'createCoupon',
    body: couponSchema,
    beyondSchema: ['`code` is unique; a duplicate is a 409, not a 400.'],
  }),

  updateCoupon: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/coupons/{id}',
    operation: 'updateCoupon',
    body: couponUpdateSchema,
    params: pathIdParams(),
    beyondSchema: [
      'PATCH-style: a field the body omits is left alone. Deliberately not the create ' +
        'schema, for the reason recorded on the schema itself.',
    ],
  }),

  deleteCoupon: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/coupons/{id}',
    operation: 'deleteCoupon',
    params: pathIdParams(),
  }),

  validateCoupon: defineRequestContract({
    method: 'POST',
    path: '/api/v1/coupons/validate',
    operation: 'validateCoupon',
    body: validateCouponSchema,
    beyondSchema: [
      'A dry run: it answers whether the code applies to this cart and what it is worth, ' +
        'and consumes nothing. The redemption happens when the sale is created, so a ' +
        'coupon validated here can still fail at checkout if it runs out in between.',
    ],
  }),
} as const;

export const couponsContractList = Object.values(couponsRequestContracts);
