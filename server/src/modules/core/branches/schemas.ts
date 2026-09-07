/**
 * The branches module's request contracts (#102).
 *
 * The two body schemas moved out of the controller unchanged. They were declared there,
 * which is why nothing could document them.
 */
import { z } from 'zod';
import { defineRequestContract } from '../../../http/requestContracts';
import { transferListQuerySchema } from './types';

/** Path ids arrive as strings and are `Number()`-ed by the controller. */
export const branchIdParamsSchema = z
  .object({ id: z.string().regex(/^\d+$/, 'id must be a positive integer') })
  .strict();

export const branchSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  address: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  is_main: z.boolean().optional(),
});

export const transferSchema = z.object({
  source_branch_id: z.number().int().positive(),
  target_branch_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive(),
  notes: z.string().max(255).optional(),
});

/**
 * The status transition.
 *
 * The controller was `const { status } = req.body` with no validation, so the service's
 * own check was the only gate — and it accepts three values, not the four the transfer
 * *filter* enum offers. `pending` is the state a transfer is created in and cannot be
 * moved back to, so documenting the filter's four here would have promised a transition
 * that answers 400.
 *
 * The acceptance set is unchanged by moving the check here: both reject the same values
 * with the same status code.
 */
export const transferStatusSchema = z
  .object({ status: z.enum(['in_transit', 'completed', 'cancelled']) })
  .strict();

export const branchesRequestContracts = {
  listBranches: defineRequestContract({
    method: 'GET',
    path: '/api/v1/branches',
    operation: 'listBranches',
  }),

  createBranch: defineRequestContract({
    method: 'POST',
    path: '/api/v1/branches',
    operation: 'createBranch',
    body: branchSchema,
    beyondSchema: ['`code` is unique across branches; a duplicate is a 409, not a 400.'],
  }),

  updateBranch: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/branches/{id}',
    operation: 'updateBranch',
    body: branchSchema,
    params: branchIdParamsSchema,
    beyondSchema: [
      'A full replacement, not a merge: `name` and `code` are required on an update too.',
    ],
  }),

  getConsolidated: defineRequestContract({
    method: 'GET',
    path: '/api/v1/branches/consolidated',
    operation: 'getConsolidated',
  }),

  listTransfers: defineRequestContract({
    method: 'GET',
    path: '/api/v1/branches/transfers',
    operation: 'listTransfers',
    query: transferListQuerySchema,
    beyondSchema: [
      '`sortBy` defaults to `createdAt` through a transform the generator drops; an ' +
        'omitted `sortBy` therefore behaves as `createdAt` rather than as unsorted.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  createTransfer: defineRequestContract({
    method: 'POST',
    path: '/api/v1/branches/transfers',
    operation: 'createTransfer',
    body: transferSchema,
    beyondSchema: [
      'Source and target must differ, and the source must hold at least `quantity`. ' +
        'Both are checked by the service against live stock, so they are conflicts ' +
        'rather than schema violations.',
    ],
  }),

  updateTransferStatus: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/branches/transfers/{id}/status',
    operation: 'updateTransferStatus',
    body: transferStatusSchema,
    params: branchIdParamsSchema,
    beyondSchema: [
      '`pending` is the creation state and is not a transition target, which is why it ' +
        'appears in the transfer filter but not here.',
      'Moving to `completed` moves the stock, in one transaction, and is not reversible ' +
        'by setting the status back.',
    ],
  }),
} as const;

export const branchesContractList = Object.values(branchesRequestContracts);
