/**
 * The exports module's request contracts (#102).
 *
 * These answer with a CSV file rather than the usual JSON envelope, which the response
 * documentation already records and this does not change.
 */
import { defineRequestContract } from '../../../http/requestContracts';
import { exportSalesQuerySchema } from './types';

export const exportsRequestContracts = {
  exportProducts: defineRequestContract({
    method: 'GET',
    path: '/api/v1/exports/products',
    operation: 'exportProducts',
    beyondSchema: ['Exports the whole catalogue; there is nothing to filter by.'],
  }),

  exportSales: defineRequestContract({
    method: 'GET',
    path: '/api/v1/exports/sales',
    operation: 'exportSales',
    query: exportSalesQuerySchema,
    beyondSchema: [
      'The only export with a date range, because a sales export over all time is the ' +
        'one that gets large enough to matter.',
    ],
  }),

  exportCustomers: defineRequestContract({
    method: 'GET',
    path: '/api/v1/exports/customers',
    operation: 'exportCustomers',
    beyondSchema: ['Contains personal data: names, phone numbers and addresses.'],
  }),
} as const;

export const exportsContractList = Object.values(exportsRequestContracts);
