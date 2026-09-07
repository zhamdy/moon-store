/**
 * The exchanges module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { exchangeListQuerySchema } from './types';

export const exchangeSchema = z.object({
  original_sale_id: z.number().int().positive(),
  returned_items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().min(0),
        reason: z.string().min(1),
        condition: z.enum(['good', 'damaged', 'defective']).default('good'),
      })
    )
    .min(1),
  new_items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().min(0),
      })
    )
    .min(1),
  payment_method: z.enum(['cash', 'card', 'store_credit']).optional(),
  notes: z.string().max(500).optional(),
});

export type ExchangeBody = z.infer<typeof exchangeSchema>;

export const exchangesRequestContracts = {
  createExchange: defineRequestContract({
    method: 'POST',
    path: '/api/v1/exchanges',
    operation: 'createExchange',
    body: exchangeSchema,
    beyondSchema: [
      'Both sides are required and non-empty: an exchange with nothing coming back is a ' +
        'sale, and one with nothing going out is a refund. Those endpoints exist.',
      '`condition` decides whether a returned item goes back into sellable stock. Only ' +
        '`good` does; `damaged` and `defective` are recorded and written off.',
      'The price difference either way is settled by `payment_method`; `store_credit` ' +
        'issues or consumes credit rather than moving cash.',
    ],
  }),

  listExchanges: defineRequestContract({
    method: 'GET',
    path: '/api/v1/exchanges',
    operation: 'listExchanges',
    query: exchangeListQuerySchema,
    beyondSchema: [
      '`sortBy` defaults through a transform the generator drops.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  getExchange: defineRequestContract({
    method: 'GET',
    path: '/api/v1/exchanges/{id}',
    operation: 'getExchange',
    params: pathIdParams(),
  }),
} as const;

export const exchangesContractList = Object.values(exchangesRequestContracts);
