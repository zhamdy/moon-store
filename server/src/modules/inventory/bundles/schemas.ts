/**
 * The bundles module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { bundleListQuerySchema } from './types';

export const bundleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  bundle_price: z.number().positive(),
  starts_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
      })
    )
    .min(2, 'A bundle must contain at least 2 products'),
});

export type BundleBody = z.infer<typeof bundleSchema>;

export const bundlesRequestContracts = {
  listBundles: defineRequestContract({
    method: 'GET',
    path: '/api/v1/bundles',
    operation: 'listBundles',
    query: bundleListQuerySchema,
    beyondSchema: [
      '`sortBy` defaults through a transform the generator drops.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  getBundle: defineRequestContract({
    method: 'GET',
    path: '/api/v1/bundles/{id}',
    operation: 'getBundle',
    params: pathIdParams(),
  }),

  createBundle: defineRequestContract({
    method: 'POST',
    path: '/api/v1/bundles',
    operation: 'createBundle',
    body: bundleSchema,
    beyondSchema: [
      'At least two products: one product at a discount is a price change, not a bundle.',
      '`bundle_price` is the total for the set, not a per-item price or a discount rate.',
      '`starts_at` and `expires_at` are strings and are not range-checked here.',
    ],
  }),

  updateBundle: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/bundles/{id}',
    operation: 'updateBundle',
    body: bundleSchema,
    params: pathIdParams(),
    beyondSchema: [
      'A full replacement, not a merge: `items` replaces the whole set, so an update ' +
        'that omits a product removes it.',
    ],
  }),

  deleteBundle: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/bundles/{id}',
    operation: 'deleteBundle',
    params: pathIdParams(),
  }),
} as const;

export const bundlesContractList = Object.values(bundlesRequestContracts);
