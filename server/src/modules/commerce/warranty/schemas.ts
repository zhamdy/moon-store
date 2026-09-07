/**
 * The warranty module's request contracts (#102).
 *
 * The schemas moved out of the controller. A `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load, even where vitest does not care.
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { warrantyListQuerySchema } from './types';

export const warrantyClaimSchema = z.object({
  sale_id: z.number().int().positive().optional(),
  product_id: z.number().int().positive(),
  customer_id: z.number().int().positive().optional(),
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().min(1).max(30),
  issue_description: z.string().min(1).max(500),
  resolution: z.string().max(500).optional(),
});

/**
 * The update body, which is not the claim schema.
 *
 * `PUT /warranty/{id}` reads only `status` and `resolution` off the body and ignores
 * everything else; documenting the create schema here would have promised that a claim's
 * product or customer can be corrected, which this endpoint cannot do.
 */
export const warrantyUpdateSchema = z.object({
  status: z.string().min(1).max(30).optional(),
  resolution: z.string().max(500).optional(),
});

export type WarrantyUpdateBody = z.infer<typeof warrantyUpdateSchema>;

export const warrantyRequestContracts = {
  listClaims: defineRequestContract({
    method: 'GET',
    path: '/api/v1/warranty',
    operation: 'listClaims',
    query: warrantyListQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),

  createClaim: defineRequestContract({
    method: 'POST',
    path: '/api/v1/warranty',
    operation: 'createClaim',
    body: warrantyClaimSchema,
  }),

  updateClaim: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/warranty/{id}',
    operation: 'updateClaim',
    body: warrantyUpdateSchema,
    params: pathIdParams(),
    beyondSchema: [
      'Only `status` and `resolution` can be changed. The claim itself — product, ' +
        'customer, description — is fixed once filed.',
      'An omitted field is left alone rather than cleared.',
    ],
  }),
} as const;

export const warrantyContractList = Object.values(warrantyRequestContracts);
