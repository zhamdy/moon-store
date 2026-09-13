/**
 * The giftCards module's request contracts (#102).
 *
 * The schemas moved out of the controller. A `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load, even where vitest does not care.
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { giftCardListQuerySchema, giftCardTransactionQuerySchema } from './types';

export const createGiftCardSchema = z.object({
  code: z.string().min(4).max(50).optional(),
  initial_value: z.number().positive('Initial value must be positive'),
  customer_id: z.number().int().positive().optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

export const redeemGiftCardSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  sale_id: z.number().int().positive('Sale ID is required'),
});

export const updateGiftCardSchema = z.object({
  status: z.enum(['active', 'cancelled']),
});

/** A gift card code is printed on the card, not a row id. */
export const giftCardCodeParamsSchema = z.object({ code: z.string().min(1).max(100) }).strict();

export const giftCardsRequestContracts = {
  listGiftCards: defineRequestContract({
    method: 'GET',
    path: '/api/v1/gift-cards',
    operation: 'listGiftCards',
    query: giftCardListQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),

  createGiftCard: defineRequestContract({
    method: 'POST',
    path: '/api/v1/gift-cards',
    operation: 'createGiftCard',
    body: createGiftCardSchema,
  }),

  getBalance: defineRequestContract({
    method: 'GET',
    path: '/api/v1/gift-cards/{code}/balance',
    operation: 'getBalance',
    params: giftCardCodeParamsSchema,
    beyondSchema: [
      'Keyed on the printed code rather than the row id, because the person holding the ' +
        'card has the code and nothing else.',
    ],
  }),

  redeemGiftCard: defineRequestContract({
    method: 'POST',
    path: '/api/v1/gift-cards/{code}/redeem',
    operation: 'redeemGiftCard',
    body: redeemGiftCardSchema,
    params: giftCardCodeParamsSchema,
    beyondSchema: [
      'Redeeming moves money: a partial redemption leaves the remainder on the card, and ' +
        'an amount above the balance is refused rather than clamped.',
    ],
  }),

  getTransactions: defineRequestContract({
    method: 'GET',
    path: '/api/v1/gift-cards/{id}/transactions',
    operation: 'getTransactions',
    params: pathIdParams(),
    query: giftCardTransactionQuerySchema,
    beyondSchema: ['Keyed on the row id here, unlike balance and redeem which take the code.'],
  }),

  updateGiftCard: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/gift-cards/{id}',
    operation: 'updateGiftCard',
    body: updateGiftCardSchema,
    params: pathIdParams(),
  }),
} as const;

export const giftCardsContractList = Object.values(giftCardsRequestContracts);
