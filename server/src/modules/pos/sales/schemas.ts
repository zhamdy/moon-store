/**
 * The sales module's request contracts (#102).
 *
 * The money path. `saleSchema` and `refundSchema` already carried the payment rules; what
 * was missing was any published description of them at all — the document said
 * `additionalProperties: true` for a checkout body.
 */
import { refundSchema, saleSchema } from '../../../../validators/saleSchema';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { saleListQuerySchema } from './types';

export const salesRequestContracts = {
  listSales: defineRequestContract({
    method: 'GET',
    path: '/api/v1/sales',
    operation: 'listSales',
    query: saleListQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),

  getSale: defineRequestContract({
    method: 'GET',
    path: '/api/v1/sales/{id}',
    operation: 'getSale',
    params: pathIdParams(),
  }),

  createSale: defineRequestContract({
    method: 'POST',
    path: '/api/v1/sales',
    operation: 'createSale',
    body: saleSchema,
    beyondSchema: [
      'Send an `Idempotency-Key` header. A repeated key returns the original sale ' +
        'byte-identically with `Idempotent-Replay: true`; the same key with a different ' +
        'payload is a 409 `IDEMPOTENCY_KEY_REUSED`. Generate one per rung-up sale, not ' +
        'per HTTP request, so a transport retry and an offline replay share it.',
      'The server recomputes every total from the items, the settings and the coupon. ' +
        'Amounts in the body are checked against that calculation, not trusted.',
      'Stock is deducted inside the same transaction, so an item that went out of stock ' +
        'between rendering the cart and submitting it fails the whole sale.',
    ],
  }),

  refundSale: defineRequestContract({
    method: 'POST',
    path: '/api/v1/sales/{id}/refund',
    operation: 'refundSale',
    body: refundSchema,
    params: pathIdParams(),
    beyondSchema: [
      'Partial refunds are allowed, but the cumulative quantity refunded per line can ' +
        'never exceed what was sold — the check is against prior refunds, not this one.',
      'Refunded stock is returned to inventory in the same transaction.',
    ],
  }),
} as const;

export const salesContractList = Object.values(salesRequestContracts);
