/**
 * The vendors module's request contracts (#102).
 *
 * The schemas moved out of the controller. A `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load, even where vitest does not care.
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { vendorListQuerySchema, vendorPayoutQuerySchema } from './types';

export const vendorSchema = z.object({
  name: z.string().min(1).max(100),
  contact_person: z.string().max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional(),
  address: z.string().max(255).optional(),
  tax_number: z.string().max(50).optional(),
  commission_rate: z.number().min(0).max(100).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});

/**
 * The update body is a genuine partial, and deliberately not `vendorSchema`.
 *
 * Re-using the create schema here meant every field was optional *and* two of them carried
 * a `.default()`, so a body that named only some fields parsed cleanly and the repository
 * then wrote defaults over the rest. The Vendors page never sends `contact_person`,
 * `tax_number` or `status` — so editing an inactive vendor silently reactivated it and
 * cleared its tax number. Same shape as #78 on collections.
 *
 * No `.default()` here: a default is what turns "absent" back into "write this value",
 * which is exactly what a partial update must not do.
 */
export const vendorUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  contact_person: z.string().max(100).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  tax_number: z.string().max(50).nullable().optional(),
  commission_rate: z.number().min(0).max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * The payout body, which the controller read straight off `req.body` with a single
 * `amount > 0` check. Everything else was taken untyped and coerced.
 */
export const vendorPayoutSchema = z.object({
  amount: z.number().positive('Valid payout amount required'),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type VendorPayoutBody = z.infer<typeof vendorPayoutSchema>;

export const vendorsRequestContracts = {
  listVendors: defineRequestContract({
    method: 'GET',
    path: '/api/v1/vendors',
    operation: 'listVendors',
    query: vendorListQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),

  createVendor: defineRequestContract({
    method: 'POST',
    path: '/api/v1/vendors',
    operation: 'createVendor',
    body: vendorSchema,
  }),

  updateVendor: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/vendors/{id}',
    operation: 'updateVendor',
    body: vendorUpdateSchema,
    params: pathIdParams(),
    beyondSchema: [
      'PATCH-style: a field the body omits is left alone, for the reason recorded on the ' +
        'schema itself.',
    ],
  }),

  listVendorPayouts: defineRequestContract({
    method: 'GET',
    path: '/api/v1/vendors/{id}/payouts',
    operation: 'listVendorPayouts',
    params: pathIdParams(),
    query: vendorPayoutQuerySchema,
  }),

  createVendorPayout: defineRequestContract({
    method: 'POST',
    path: '/api/v1/vendors/{id}/payouts',
    operation: 'createVendorPayout',
    body: vendorPayoutSchema,
    params: pathIdParams(),
    beyondSchema: [
      'The amount is taken from the body, not computed from the vendor’s unpaid ' +
        'commission. Nothing here checks it against what is actually owed.',
      '`period_start` and `period_end` are unvalidated strings recording what the payout ' +
        'covers; they are not range-checked against each other.',
    ],
  }),
} as const;

export const vendorsContractList = Object.values(vendorsRequestContracts);
