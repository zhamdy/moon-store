/**
 * The audit log module's request contracts (#102).
 */
import { defineRequestContract } from '../../../http/requestContracts';
import { auditLogListQuerySchema } from './types';

export const auditLogRequestContracts = {
  listAuditLogs: defineRequestContract({
    method: 'GET',
    path: '/api/v1/audit-log',
    operation: 'listAuditLogs',
    query: auditLogListQuerySchema,
    beyondSchema: [
      '`dateFrom` must not be after `dateTo`. This is a cross-field rule, which OpenAPI ' +
        'cannot express and the generator drops silently — hence stating it here.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  listActions: defineRequestContract({
    method: 'GET',
    path: '/api/v1/audit-log/actions',
    operation: 'listActions',
  }),

  listEntityTypes: defineRequestContract({
    method: 'GET',
    path: '/api/v1/audit-log/entity-types',
    operation: 'listEntityTypes',
  }),
} as const;

export const auditLogContractList = Object.values(auditLogRequestContracts);
