/**
 * The storeCredit module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';

export const redeemStoreCreditSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  sale_id: z.number().int().positive().optional().nullable(),
});

export const issueStoreCreditSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().min(1).max(200),
});

export const storeCreditRequestContracts = {
  getStoreCreditBalance: defineRequestContract({
    method: 'GET',
    path: '/api/v1/store-credit/{id}',
    operation: 'getStoreCreditBalance',
    params: pathIdParams(),
    noBody: true,
    beyondSchema: [
      'The id is a customer id, not a credit id: credit is a balance a customer holds, ' +
        'not a document. The balance is the sum of the ledger entries returned ' +
        'alongside it, so it can always be explained rather than merely asserted.',
      'Store credit never expires and is not redeemable for cash.',
    ],
  }),

  redeemStoreCredit: defineRequestContract({
    method: 'POST',
    path: '/api/v1/store-credit/{id}/redeem',
    operation: 'redeemStoreCredit',
    body: redeemStoreCreditSchema,
    params: pathIdParams(),
    beyondSchema: [
      'Refuses with a 409 rather than overdrawing, naming the balance available. The ' +
        'balance is locked for the transaction, so two tills redeeming at once cannot ' +
        'both spend the same credit.',
    ],
  }),

  issueStoreCredit: defineRequestContract({
    method: 'POST',
    path: '/api/v1/store-credit/{id}/issue',
    operation: 'issueStoreCredit',
    body: issueStoreCreditSchema,
    params: pathIdParams(),
    beyondSchema: [
      'Admin only, and for corrections: the ordinary way credit is issued is an ' +
        'exchange that leaves the shop owing the customer money, which writes its own ' +
        'entry inside the exchange transaction.',
    ],
  }),
} as const;

export const storeCreditContractList = Object.values(storeCreditRequestContracts);
