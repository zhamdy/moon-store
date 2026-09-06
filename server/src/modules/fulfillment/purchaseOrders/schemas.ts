/**
 * The purchase orders module's request contracts (#102).
 */
import { z } from 'zod';
import { purchaseOrderSchema, receiveSchema } from '../../../../validators/purchaseOrderSchema';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { purchaseOrderListQuerySchema } from './types';

/**
 * The status transition list the controller checked by hand. Read from the code rather
 * than inferred from the domain, because `Partially Received` is the kind of value a
 * guess omits and a receiving clerk depends on.
 */
export const purchaseOrderStatusSchema = z
  .object({
    status: z.enum(['Draft', 'Sent', 'Partially Received', 'Received', 'Cancelled']),
  })
  .strict();

export type PurchaseOrderStatusBody = z.infer<typeof purchaseOrderStatusSchema>;

export const purchaseOrdersRequestContracts = {
  listPurchaseOrders: defineRequestContract({
    method: 'GET',
    path: '/api/v1/purchase-orders',
    operation: 'listPurchaseOrders',
    query: purchaseOrderListQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),

  getPurchaseOrder: defineRequestContract({
    method: 'GET',
    path: '/api/v1/purchase-orders/{id}',
    operation: 'getPurchaseOrder',
    params: pathIdParams(),
  }),

  createPurchaseOrder: defineRequestContract({
    method: 'POST',
    path: '/api/v1/purchase-orders',
    operation: 'createPurchaseOrder',
    body: purchaseOrderSchema,
  }),

  updatePurchaseOrderStatus: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/purchase-orders/{id}/status',
    operation: 'updatePurchaseOrderStatus',
    body: purchaseOrderStatusSchema,
    params: pathIdParams(),
    beyondSchema: [
      'Setting a status here does not move stock. Only `receive` does that, which is why ' +
        'marking an order Received by hand leaves the inventory untouched.',
    ],
  }),

  receivePurchaseOrder: defineRequestContract({
    method: 'POST',
    path: '/api/v1/purchase-orders/{id}/receive',
    operation: 'receivePurchaseOrder',
    body: receiveSchema,
    params: pathIdParams(),
    beyondSchema: [
      'Receiving is what adds stock, and it is partial by design: send the quantities ' +
        'that actually arrived and the order lands on `Partially Received` until the ' +
        'rest do. The resulting status is computed by the server and returned.',
    ],
  }),

  deletePurchaseOrder: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/purchase-orders/{id}',
    operation: 'deletePurchaseOrder',
    params: pathIdParams(),
  }),
} as const;

export const purchaseOrdersContractList = Object.values(purchaseOrdersRequestContracts);
