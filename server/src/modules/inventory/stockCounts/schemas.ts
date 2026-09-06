/**
 * The stock counts module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { stockCountListQuerySchema } from './types';

export const createStockCountSchema = z.object({
  category_id: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const updateCountItemSchema = z.object({
  counted_qty: z.number().int().min(0),
  notes: z.string().max(255).optional(),
});

export type CreateStockCountBody = z.infer<typeof createStockCountSchema>;
export type UpdateCountItemBody = z.infer<typeof updateCountItemSchema>;

export const countItemParamsSchema = z
  .object({
    id: z.string().regex(/^\d+$/, 'id must be a positive integer'),
    itemId: z.string().regex(/^\d+$/, 'itemId must be a positive integer'),
  })
  .strict();

export const stockCountsRequestContracts = {
  listStockCounts: defineRequestContract({
    method: 'GET',
    path: '/api/v1/stock-counts',
    operation: 'listStockCounts',
    query: stockCountListQuerySchema,
    beyondSchema: [
      '`sortBy` defaults through a transform the generator drops.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  createStockCount: defineRequestContract({
    method: 'POST',
    path: '/api/v1/stock-counts',
    operation: 'createStockCount',
    body: createStockCountSchema,
    beyondSchema: [
      'Opening a count snapshots the expected quantity of every product in scope, so an ' +
        'omitted `category_id` counts the whole catalogue.',
    ],
  }),

  getStockCount: defineRequestContract({
    method: 'GET',
    path: '/api/v1/stock-counts/{id}',
    operation: 'getStockCount',
    params: pathIdParams(),
  }),

  updateCountItem: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/stock-counts/{id}/items/{itemId}',
    operation: 'updateCountItem',
    body: updateCountItemSchema,
    params: countItemParamsSchema,
    beyondSchema: [
      '`counted_qty` is the absolute quantity on the shelf, not a delta, and zero is a ' +
        'legitimate count rather than a missing one.',
    ],
  }),

  completeStockCount: defineRequestContract({
    noBody: true,
    method: 'POST',
    path: '/api/v1/stock-counts/{id}/complete',
    operation: 'completeStockCount',
    params: pathIdParams(),
    beyondSchema: [
      'Takes no body. Completing applies every counted variance to live stock in one ' +
        'transaction and cannot be undone by cancelling afterwards.',
    ],
  }),

  cancelStockCount: defineRequestContract({
    noBody: true,
    method: 'POST',
    path: '/api/v1/stock-counts/{id}/cancel',
    operation: 'cancelStockCount',
    params: pathIdParams(),
    beyondSchema: ['Takes no body. Discards the counted quantities; stock is untouched.'],
  }),
} as const;

export const stockCountsContractList = Object.values(stockCountsRequestContracts);
