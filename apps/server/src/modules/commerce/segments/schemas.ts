/**
 * The segments module's request contracts (#102).
 *
 * The schemas moved out of the controller. A `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load, even where vitest does not care.
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';

export const segmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rules_json: z.string().min(2),
});

export const segmentsRequestContracts = {
  listSegments: defineRequestContract({
    method: 'GET',
    path: '/api/v1/segments',
    operation: 'listSegments',
  }),

  createSegment: defineRequestContract({
    method: 'POST',
    path: '/api/v1/segments',
    operation: 'createSegment',
    body: segmentSchema,
    beyondSchema: [
      'A segment is a stored set of filter rules, evaluated when it is read rather than ' +
        'a frozen list of customers, so its membership changes as customers do.',
    ],
  }),

  updateSegment: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/segments/{id}',
    operation: 'updateSegment',
    body: segmentSchema,
    params: pathIdParams(),
    beyondSchema: ['A full replacement, not a merge.'],
  }),

  deleteSegment: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/segments/{id}',
    operation: 'deleteSegment',
    params: pathIdParams(),
  }),
} as const;

export const segmentsContractList = Object.values(segmentsRequestContracts);
