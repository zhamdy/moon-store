/**
 * The feedback module's request contracts (#102).
 *
 * The schemas moved out of the controller. A `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load, even where vitest does not care.
 */
import { z } from 'zod';
import { defineRequestContract } from '../../../http/requestContracts';
import { feedbackListQuerySchema } from './types';

export const feedbackSchema = z.object({
  customer_id: z.number().int().positive().optional(),
  sale_id: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5),
  category: z
    .enum(['service', 'product_quality', 'pricing', 'store_ambiance', 'general'])
    .default('general'),
  comment: z.string().max(500).optional(),
});

export const feedbackRequestContracts = {
  createFeedback: defineRequestContract({
    method: 'POST',
    path: '/api/v1/feedback',
    operation: 'createFeedback',
    body: feedbackSchema,
    beyondSchema: [
      'Public: a shopper submits this without a token, which is why the rate limit is ' +
        'the only thing standing between it and a flood of ratings.',
    ],
  }),

  listFeedback: defineRequestContract({
    method: 'GET',
    path: '/api/v1/feedback',
    operation: 'listFeedback',
    query: feedbackListQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),
} as const;

export const feedbackContractList = Object.values(feedbackRequestContracts);
