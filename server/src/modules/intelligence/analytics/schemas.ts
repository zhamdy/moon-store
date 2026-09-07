/**
 * The analytics module's request contracts (#102).
 *
 * Sixteen read-only operations over four query shapes. None of them had a documented
 * parameter before this: the spec described the responses and said nothing about how to
 * ask for a date range or a page.
 */
import { defineRequestContract } from '../../../http/requestContracts';
import {
  analyticsDateQuerySchema,
  analyticsDaysPageQuerySchema,
  analyticsDaysQuerySchema,
  analyticsPageQuerySchema,
} from './types';

export const analyticsRequestContracts = {
  getDashboardAll: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/dashboard-all',
    operation: 'getDashboardAll',
    query: analyticsDateQuerySchema,
  }),

  getDashboard: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/dashboard',
    operation: 'getDashboard',
  }),

  getRevenue: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/revenue',
    operation: 'getRevenue',
    query: analyticsDateQuerySchema,
  }),

  getTopProducts: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/top-products',
    operation: 'getTopProducts',
    query: analyticsPageQuerySchema,
  }),

  getPaymentMethods: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/payment-methods',
    operation: 'getPaymentMethods',
    query: analyticsDateQuerySchema,
  }),

  getOrdersPerDay: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/orders-per-day',
    operation: 'getOrdersPerDay',
    query: analyticsDateQuerySchema,
  }),

  getCashierPerformance: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/cashier-performance',
    operation: 'getCashierPerformance',
    query: analyticsPageQuerySchema,
  }),

  getSalesByCategory: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/sales-by-category',
    operation: 'getSalesByCategory',
    query: analyticsPageQuerySchema,
  }),

  getSalesByDistributor: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/sales-by-distributor',
    operation: 'getSalesByDistributor',
    query: analyticsPageQuerySchema,
  }),

  getDeadStock: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/dead-stock',
    operation: 'getDeadStock',
    query: analyticsDaysPageQuerySchema,
    beyondSchema: [
      '`days` is optional on the wire and defaults to 90 after parsing, so an omitted ' +
        'value is a 90-day window rather than an unbounded one.',
    ],
  }),

  getCustomerLtv: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/customer-ltv',
    operation: 'getCustomerLtv',
    query: analyticsPageQuerySchema,
  }),

  getHourlyHeatmap: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/hourly-heatmap',
    operation: 'getHourlyHeatmap',
    query: analyticsDaysQuerySchema,
    beyondSchema: [
      '`days` is optional on the wire and defaults to 30 after parsing, so an omitted ' +
        'value is a 30-day window rather than an unbounded one.',
    ],
  }),

  getAbcClassification: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/abc-classification',
    operation: 'getAbcClassification',
    query: analyticsPageQuerySchema,
  }),

  getReorderSuggestions: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/reorder-suggestions',
    operation: 'getReorderSuggestions',
    query: analyticsPageQuerySchema,
  }),

  getInventorySnapshots: defineRequestContract({
    method: 'GET',
    path: '/api/v1/analytics/inventory-snapshots',
    operation: 'getInventorySnapshots',
    query: analyticsPageQuerySchema,
  }),

  createInventorySnapshot: defineRequestContract({
    noBody: true,
    method: 'POST',
    path: '/api/v1/analytics/inventory-snapshot',
    operation: 'createInventorySnapshot',
    beyondSchema: [
      'Takes no body: it snapshots the whole catalogue as it stands now, which is why ' +
        'there is nothing to parameterise.',
    ],
  }),
} as const;

export const analyticsContractList = Object.values(analyticsRequestContracts);
