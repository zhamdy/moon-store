/**
 * The distributors module's request contracts (#102).
 */
import { distributorSchema } from '../../../../validators/distributorSchema';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';

export const distributorsRequestContracts = {
  listDistributors: defineRequestContract({
    method: 'GET',
    path: '/api/v1/distributors',
    operation: 'listDistributors',
  }),

  createDistributor: defineRequestContract({
    method: 'POST',
    path: '/api/v1/distributors',
    operation: 'createDistributor',
    body: distributorSchema,
    beyondSchema: [
      '`email` accepts a valid address, null, or the empty string. The empty string is ' +
        'there because a form submits one for a field left blank, and rejecting it would ' +
        'make an optional field impossible to leave empty from a browser.',
    ],
  }),

  updateDistributor: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/distributors/{id}',
    operation: 'updateDistributor',
    body: distributorSchema,
    params: pathIdParams(),
    beyondSchema: ['A full replacement, not a merge: `name` is required on an update too.'],
  }),

  deleteDistributor: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/distributors/{id}',
    operation: 'deleteDistributor',
    params: pathIdParams(),
    beyondSchema: ['A distributor still referenced by products is a 409, not a 404.'],
  }),
} as const;

export const distributorsContractList = Object.values(distributorsRequestContracts);
