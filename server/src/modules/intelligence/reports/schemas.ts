/**
 * The reports module's request contracts (#102).
 */
import { defineRequestContract } from '../../../http/requestContracts';
import { inventoryReportQuerySchema, profitLossQuerySchema, salesReportQuerySchema } from './types';

export const reportsRequestContracts = {
  getSalesReport: defineRequestContract({
    method: 'GET',
    path: '/api/v1/reports/sales',
    operation: 'getSalesReport',
    query: salesReportQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),

  getInventoryReport: defineRequestContract({
    method: 'GET',
    path: '/api/v1/reports/inventory',
    operation: 'getInventoryReport',
    query: inventoryReportQuerySchema,
  }),

  getProfitLossReport: defineRequestContract({
    method: 'GET',
    path: '/api/v1/reports/profit-loss',
    operation: 'getProfitLossReport',
    query: profitLossQuerySchema,
  }),
} as const;

export const reportsContractList = Object.values(reportsRequestContracts);
