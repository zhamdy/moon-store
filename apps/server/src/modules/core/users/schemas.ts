/**
 * The users module's request contracts (#102).
 *
 * Pure: no service, repository, or database import reaches this file, so `buildOpenApi`
 * can import every module's contracts to generate a document without booting anything or
 * holding a credential.
 *
 * The schemas are the ones that already validated these requests. `createUserSchema` and
 * `updateUserSchema` still live in `validators/userSchema.ts` and are imported, not
 * copied — a copy is exactly the second description this change removes. The favourites
 * schema had no home at all: it was declared inline in the controller, which is why
 * nothing could document it.
 */
import { z } from 'zod';
import { createUserSchema, updateUserSchema } from '../../../../validators/userSchema';
import { defineRequestContract } from '../../../http/requestContracts';
import { userListQuerySchema } from './types';

/** Every `:id` on this router is a database id in the path, arriving as a string. */
export const userIdParamsSchema = z
  .object({ id: z.string().regex(/^\d+$/, 'id must be a positive integer') })
  .strict();

/**
 * `z.unknown()` because a favourite is whatever the till stores — the server caps the
 * count and does not interpret the entries. Documenting that honestly beats inventing an
 * item schema the validator would not enforce.
 */
export const favoritesSchema = z.object({ favorites: z.array(z.unknown()).max(100) }).strict();

export const usersRequestContracts = {
  listUsers: defineRequestContract({
    method: 'GET',
    path: '/api/v1/users',
    operation: 'listUsers',
    query: userListQuerySchema,
    beyondSchema: [
      'The query is strict: any parameter not listed here is rejected, not ignored. ' +
        'OpenAPI has no way to say that, so a caller sending `limit` would read this ' +
        'document as permissive and get a 400.',
    ],
  }),

  listDeliveryUsers: defineRequestContract({
    method: 'GET',
    path: '/api/v1/users/delivery',
    operation: 'listDeliveryUsers',
  }),

  createUser: defineRequestContract({
    method: 'POST',
    path: '/api/v1/users',
    operation: 'createUser',
    body: createUserSchema,
  }),

  getFavorites: defineRequestContract({
    method: 'GET',
    path: '/api/v1/users/me/favorites',
    operation: 'getFavorites',
  }),

  updateFavorites: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/users/me/favorites',
    operation: 'updateFavorites',
    body: favoritesSchema,
  }),

  updateUser: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/users/{id}',
    operation: 'updateUser',
    body: updateUserSchema,
    params: userIdParamsSchema,
    beyondSchema: [
      'Every field is optional, but a body with no fields at all changes nothing.',
      'password may be null, which clears it; omitting it leaves the current one.',
    ],
  }),

  deleteUser: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/users/{id}',
    operation: 'deleteUser',
    params: userIdParamsSchema,
    beyondSchema: ['A user cannot delete their own account.'],
  }),
} as const;

export const usersContractList = Object.values(usersRequestContracts);
