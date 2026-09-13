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
        'never exceed what was sold — the check is against prior refunds AND prior ' +
        'exchanges of the same sale, not against this request alone. A refund and an ' +
        'exchange are two routes to the same recovery and draw on one quantity.',
      'Refunded stock is returned to inventory in the same transaction.',
      "A line's unit_price is accepted for backward compatibility but ignored: the " +
        'payout is always the price the line actually sold for, read from the sale.',
      'A line is matched on (product_id, variant_id): two variants of the same product ' +
        'are distinct lines, each with its own remaining-quantity cap. Omitting ' +
        'variant_id matches the plain (non-variant) line for that product.',
    ],
  }),
} as const;

export const salesContractList = Object.values(salesRequestContracts);
