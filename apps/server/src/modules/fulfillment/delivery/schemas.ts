/**
 * The delivery module's request contracts (#102).
 */
import { deliverySchema, statusUpdateSchema } from '../../../../validators/deliverySchema';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { deliveryHistoryQuerySchema, deliveryListQuerySchema } from './types';

export const deliveryRequestContracts = {
  listDeliveries: defineRequestContract({
    method: 'GET',
    path: '/api/v1/delivery',
    operation: 'listDeliveries',
    query: deliveryListQuerySchema,
    beyondSchema: [
      'A Delivery user sees only the orders assigned to them; the same request returns ' +
        'more rows for an Admin. The filter is applied server-side from the token.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  getDeliveryPerformance: defineRequestContract({
    method: 'GET',
    path: '/api/v1/delivery/analytics/performance',
    operation: 'getDeliveryPerformance',
  }),

  getDelivery: defineRequestContract({
    method: 'GET',
    path: '/api/v1/delivery/{id}',
    operation: 'getDelivery',
    params: pathIdParams(),
  }),

  createDelivery: defineRequestContract({
    method: 'POST',
    path: '/api/v1/delivery',
    operation: 'createDelivery',
    body: deliverySchema,
    beyondSchema: [
      'A delivery may name an existing customer by `customer_id` or carry the name, ' +
        'phone and address inline for a new one. Both are accepted; neither is required ' +
        'to imply the other.',
    ],
  }),

  updateDelivery: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/delivery/{id}',
    operation: 'updateDelivery',
    body: deliverySchema,
    params: pathIdParams(),
    beyondSchema: ['A full replacement, not a merge: `items` replaces the whole set.'],
  }),

  updateDeliveryStatus: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/delivery/{id}/status',
    operation: 'updateDeliveryStatus',
    body: statusUpdateSchema,
    params: pathIdParams(),
    beyondSchema: [
      'A status change can send the customer an SMS or WhatsApp message, so this is not ' +
        'a silent write: a wrong status reaches a person.',
    ],
  }),

  getDeliveryHistory: defineRequestContract({
    method: 'GET',
    path: '/api/v1/delivery/{id}/history',
    operation: 'getDeliveryHistory',
    params: pathIdParams(),
    query: deliveryHistoryQuerySchema,
  }),
} as const;

export const deliveryContractList = Object.values(deliveryRequestContracts);
