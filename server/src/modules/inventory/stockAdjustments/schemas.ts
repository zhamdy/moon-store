/**
 * The stock adjustments module's request contracts (#102).
 *
 * Read-only: adjustments are written by the products module's adjust-stock endpoint, and
 * this router only lists them.
 */
import { defineRequestContract } from '../../../http/requestContracts';
import { stockAdjustmentListQuerySchema } from './types';

export const stockAdjustmentsRequestContracts = {
  listStockAdjustments: defineRequestContract({
    method: 'GET',
    path: '/api/v1/stock-adjustments',
    operation: 'listStockAdjustments',
    query: stockAdjustmentListQuerySchema,
    beyondSchema: [
      '`sortBy` defaults to `createdAt` through a transform the generator drops, so an ' +
        'omitted `sortBy` sorts by creation date rather than leaving the order undefined.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),
} as const;

export const stockAdjustmentsContractList = Object.values(stockAdjustmentsRequestContracts);
