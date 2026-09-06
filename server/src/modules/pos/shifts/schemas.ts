/**
 * The shifts module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract } from '../../../http/requestContracts';
import { shiftListQuerySchema } from './types';

export const clockInSchema = z.object({
  branch_id: z.number().int().positive().optional(),
  notes: z.string().max(255).optional(),
});

export const clockOutSchema = z.object({
  notes: z.string().max(255).optional(),
});

export type ClockInBody = z.infer<typeof clockInSchema>;
export type ClockOutBody = z.infer<typeof clockOutSchema>;

export const shiftsRequestContracts = {
  getCurrentShift: defineRequestContract({
    method: 'GET',
    path: '/api/v1/shifts/current',
    operation: 'getCurrentShift',
    beyondSchema: ['The shift belongs to the authenticated cashier; there is no id to pass.'],
  }),

  clockIn: defineRequestContract({
    method: 'POST',
    path: '/api/v1/shifts/clock-in',
    operation: 'clockIn',
    body: clockInSchema,
    beyondSchema: ['Every field is optional, so an empty object is a valid clock-in.'],
  }),

  clockOut: defineRequestContract({
    method: 'POST',
    path: '/api/v1/shifts/clock-out',
    operation: 'clockOut',
    body: clockOutSchema,
    beyondSchema: ['Every field is optional, so an empty object is a valid clock-out.'],
  }),

  startBreak: defineRequestContract({
    method: 'POST',
    path: '/api/v1/shifts/break/start',
    operation: 'startBreak',
    beyondSchema: ['Takes no body: the break attaches to the caller’s open shift.'],
  }),

  endBreak: defineRequestContract({
    method: 'POST',
    path: '/api/v1/shifts/break/end',
    operation: 'endBreak',
    beyondSchema: ['Takes no body: ends the open break on the caller’s shift.'],
  }),

  listShifts: defineRequestContract({
    method: 'GET',
    path: '/api/v1/shifts',
    operation: 'listShifts',
    query: shiftListQuerySchema,
    beyondSchema: [
      '`sortBy` defaults through a transform the generator drops.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),
} as const;

export const shiftsContractList = Object.values(shiftsRequestContracts);
