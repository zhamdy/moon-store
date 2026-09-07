/**
 * The reservations module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';

export const reserveSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive(),
  source_type: z.enum(['cart', 'delivery', 'held']),
  source_id: z.string().optional(),
});

export type ReserveBody = z.infer<typeof reserveSchema>;

/** A source id is a client-minted correlation string, not a row id. */
export const sourceIdParamsSchema = z.object({ sourceId: z.string().min(1).max(255) }).strict();

export const reservationsRequestContracts = {
  createReservation: defineRequestContract({
    method: 'POST',
    path: '/api/v1/reservations',
    operation: 'createReservation',
    body: reserveSchema,
    beyondSchema: [
      'A reservation holds stock against a cart, delivery or held sale so two tills ' +
        'cannot sell the same last item. It expires on its own and is swept every five ' +
        'minutes by `reservation-cleanup`, so a till that crashes does not strand stock.',
      '`source_id` groups reservations so they can be released together.',
    ],
  }),

  releaseBySource: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/reservations/source/{sourceId}',
    operation: 'releaseBySource',
    params: sourceIdParamsSchema,
    beyondSchema: [
      'Releases every reservation sharing the source id, and answers 200 with a count ' +
        'even when there were none — abandoning a cart must always be able to succeed.',
    ],
  }),

  releaseReservation: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/reservations/{id}',
    operation: 'releaseReservation',
    params: pathIdParams(),
  }),
} as const;

export const reservationsContractList = Object.values(reservationsRequestContracts);
