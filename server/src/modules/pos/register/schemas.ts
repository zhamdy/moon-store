/**
 * The register module's request contracts (#102).
 *
 * The cash drawer. All three bodies were declared inside the controller.
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { historyQuerySchema } from './types';

export const openRegisterSchema = z.object({
  opening_float: z.number().min(0, 'Opening float must be non-negative'),
});

export const movementSchema = z.object({
  type: z.enum(['cash_in', 'cash_out']),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().max(500).optional(),
});

export const closeRegisterSchema = z.object({
  counted_cash: z.number().min(0, 'Counted cash must be non-negative'),
  notes: z.string().max(500).optional(),
});

export type OpenRegisterBody = z.infer<typeof openRegisterSchema>;
export type MovementBody = z.infer<typeof movementSchema>;
export type CloseRegisterBody = z.infer<typeof closeRegisterSchema>;

export const registerRequestContracts = {
  getCurrentSession: defineRequestContract({
    method: 'GET',
    path: '/api/v1/register/current',
    operation: 'getCurrentSession',
    beyondSchema: ['The session belongs to the authenticated cashier; there is no id to pass.'],
  }),

  openRegister: defineRequestContract({
    method: 'POST',
    path: '/api/v1/register/open',
    operation: 'openRegister',
    body: openRegisterSchema,
    beyondSchema: [
      '`opening_float` is the counted cash in the drawer at the start, and may be 0.',
      'A cashier with a session already open is a conflict, not a second session.',
    ],
  }),

  recordMovement: defineRequestContract({
    method: 'POST',
    path: '/api/v1/register/movement',
    operation: 'recordMovement',
    body: movementSchema,
    beyondSchema: [
      '`amount` is always positive; the direction is `type`. Sending a negative cash_out ' +
        'is rejected rather than treated as a cash_in.',
    ],
  }),

  closeRegister: defineRequestContract({
    method: 'POST',
    path: '/api/v1/register/close',
    operation: 'closeRegister',
    body: closeRegisterSchema,
    beyondSchema: [
      '`counted_cash` is what the drawer physically holds. The variance against the ' +
        'expected total is computed by the server and recorded; a discrepancy does not ' +
        'refuse the close.',
    ],
  }),

  getHistory: defineRequestContract({
    method: 'GET',
    path: '/api/v1/register/history',
    operation: 'getHistory',
    query: historyQuerySchema,
    beyondSchema: [
      '`sortBy` defaults through a transform the generator drops.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  getSessionReport: defineRequestContract({
    method: 'GET',
    path: '/api/v1/register/{id}/report',
    operation: 'getSessionReport',
    params: pathIdParams(),
  }),

  forceCloseSession: defineRequestContract({
    noBody: true,
    method: 'POST',
    path: '/api/v1/register/{id}/force-close',
    operation: 'forceCloseSession',
    params: pathIdParams(),
    beyondSchema: [
      'Admin recovery for a session whose cashier cannot close it — a till that crashed ' +
        'or a shift that ended without one. Takes no body, so no counted cash is ' +
        'recorded and the variance is unknown rather than zero.',
    ],
  }),
} as const;

export const registerContractList = Object.values(registerRequestContracts);
