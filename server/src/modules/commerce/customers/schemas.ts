/**
 * The customers module's request contracts (#102).
 *
 * The schemas moved out of the controller. A `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load, even where vitest does not care.
 */
import { z } from 'zod';
import { customerSchema } from '../../../../validators/customerSchema';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { customerListQuerySchema, customerSalesQuerySchema } from './types';

export const loyaltyAdjustSchema = z.object({
  points: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Points cannot be zero'),
  note: z.string().min(1, 'Note is required'),
});

export const customersRequestContracts = {
  listCustomers: defineRequestContract({
    method: 'GET',
    path: '/api/v1/customers',
    operation: 'listCustomers',
    query: customerListQuerySchema,
    beyondSchema: [
      'Admin only. A Cashier can create a customer and read a loyalty balance but ' +
        'cannot search, so attaching a customer to a sale is not reachable from a till.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  createCustomer: defineRequestContract({
    method: 'POST',
    path: '/api/v1/customers',
    operation: 'createCustomer',
    body: customerSchema,
    beyondSchema: ['`phone` is unique and NOT NULL; a duplicate is a 409, not a 400.'],
  }),

  updateCustomer: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/customers/{id}',
    operation: 'updateCustomer',
    body: customerSchema,
    params: pathIdParams(),
    beyondSchema: ['A full replacement, not a merge.'],
  }),

  getCustomerStats: defineRequestContract({
    method: 'GET',
    path: '/api/v1/customers/{id}/stats',
    operation: 'getCustomerStats',
    params: pathIdParams(),
  }),

  getCustomerSales: defineRequestContract({
    method: 'GET',
    path: '/api/v1/customers/{id}/sales',
    operation: 'getCustomerSales',
    params: pathIdParams(),
    query: customerSalesQuerySchema,
  }),

  getCustomerLoyalty: defineRequestContract({
    method: 'GET',
    path: '/api/v1/customers/{id}/loyalty',
    operation: 'getCustomerLoyalty',
    params: pathIdParams(),
  }),

  adjustLoyalty: defineRequestContract({
    method: 'POST',
    path: '/api/v1/customers/{id}/loyalty/adjust',
    operation: 'adjustLoyalty',
    body: loyaltyAdjustSchema,
    params: pathIdParams(),
    beyondSchema: [
      'A relative adjustment, and the only way to seed a balance. Points are the ' +
        'currency a sale can redeem, so this is an Admin lever rather than a till one.',
    ],
  }),

  deleteCustomer: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/customers/{id}',
    operation: 'deleteCustomer',
    params: pathIdParams(),
  }),
} as const;

export const customersContractList = Object.values(customersRequestContracts);
