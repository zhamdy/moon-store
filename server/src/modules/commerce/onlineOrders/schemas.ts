/**
 * The onlineOrders module's request contracts (#102).
 *
 * The schemas moved out of the controller. A `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load, even where vitest does not care.
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { onlineOrderListQuerySchema } from './types';

export const createOnlineOrderSchema = z.object({
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().min(1).max(30),
  customer_email: z.string().email().optional().nullable(),
  shipping_address: z.string().min(1).max(255),
  city: z.string().min(1).max(50),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    )
    .min(1),
  shipping_fee: z.number().min(0).default(0),
});

/** The list the controller checked by hand. Read from the code, not guessed from the domain. */
export const onlineOrderStatusSchema = z
  .object({ status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']) })
  .strict();

export const onlineOrdersRequestContracts = {
  createOnlineOrder: defineRequestContract({
    method: 'POST',
    path: '/api/v1/online-orders',
    operation: 'createOnlineOrder',
    body: createOnlineOrderSchema,
    beyondSchema: [
      'Admin-only while the storefront is postponed. Stock is RESERVED when the order ' +
        'is placed, not deducted: the units stay sellable at the till until the shop ' +
        'starts fulfilling. Moving the order to processing, shipped or delivered ' +
        'releases the hold and deducts the stock in one transaction.',
      'A hold lasts 48 hours. After that it lapses and the units are available again, ' +
        'while the order stays pending — so processing it later is re-checked against ' +
        'real stock and can be refused with a 409 if the goods went elsewhere.',
      'Cancelling releases the hold. It restores stock only if the order had reached a ' +
        'status that deducted it; a pending order never took its units off the shelf, ' +
        'so there is nothing to restore. A delivered order cannot be cancelled.',
      "Each line's `price` is accepted and ignored: the order is priced from the " +
        'catalog, since a storefront endpoint cannot let a caller name its own price.',
      'An order for more units than are AVAILABLE — stock on hand minus what other ' +
        'online orders are already holding — is refused with a 409, naming how many ' +
        'remain.',
    ],
  }),

  listOnlineOrders: defineRequestContract({
    method: 'GET',
    path: '/api/v1/online-orders',
    operation: 'listOnlineOrders',
    query: onlineOrderListQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),

  getOnlineOrder: defineRequestContract({
    method: 'GET',
    path: '/api/v1/online-orders/{id}',
    operation: 'getOnlineOrder',
    params: pathIdParams(),
  }),

  updateOnlineOrderStatus: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/online-orders/{id}/status',
    operation: 'updateOnlineOrderStatus',
    body: onlineOrderStatusSchema,
    params: pathIdParams(),
  }),
} as const;

export const onlineOrdersContractList = Object.values(onlineOrdersRequestContracts);
