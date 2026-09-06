/**
 * The layaway module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { layawayListQuerySchema } from './types';

export const createLayawaySchema = z.object({
  customer_id: z.number().int().positive(),
  total_amount: z.number().positive(),
  deposit_amount: z.number().positive(),
  payment_method: z.enum(['cash', 'card']).default('cash'),
  due_date: z.string(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().min(0),
      })
    )
    .min(1),
});

export const installmentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.enum(['cash', 'card']).default('cash'),
  notes: z.string().max(255).optional(),
});

export type CreateLayawayBody = z.infer<typeof createLayawaySchema>;
export type InstallmentBody = z.infer<typeof installmentSchema>;

export const layawayRequestContracts = {
  createPlan: defineRequestContract({
    method: 'POST',
    path: '/api/v1/layaway',
    operation: 'createPlan',
    body: createLayawaySchema,
    beyondSchema: [
      'A layaway needs a customer: unlike a sale, there is someone to come back for it.',
      '`deposit_amount` must be positive — a plan with no deposit is an order, not a ' +
        'layaway — and the balance owed is `total_amount` minus what has been paid.',
      '`due_date` is a string and is not format-checked here.',
    ],
  }),

  listPlans: defineRequestContract({
    method: 'GET',
    path: '/api/v1/layaway',
    operation: 'listPlans',
    query: layawayListQuerySchema,
    beyondSchema: [
      '`sortBy` defaults through a transform the generator drops.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  getPlan: defineRequestContract({
    method: 'GET',
    path: '/api/v1/layaway/{id}',
    operation: 'getPlan',
    params: pathIdParams(),
  }),

  payInstallment: defineRequestContract({
    method: 'POST',
    path: '/api/v1/layaway/{id}/pay',
    operation: 'payInstallment',
    body: installmentSchema,
    params: pathIdParams(),
    beyondSchema: [
      '`amount` is this payment, not the running total. Paying off the balance completes ' +
        'the plan and releases the goods.',
    ],
  }),

  cancelPlan: defineRequestContract({
    method: 'POST',
    path: '/api/v1/layaway/{id}/cancel',
    operation: 'cancelPlan',
    params: pathIdParams(),
    beyondSchema: [
      'Takes no body. Cancelling returns the reserved items to stock; what happens to ' +
        'money already paid is a shop policy the endpoint does not decide.',
    ],
  }),
} as const;

export const layawayContractList = Object.values(layawayRequestContracts);
