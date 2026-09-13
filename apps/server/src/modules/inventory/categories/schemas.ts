/**
 * The categories module's request contracts (#102).
 *
 * The body schema already lived in `validators/categorySchema.ts` and is imported, not
 * copied — a copy is the second description this work removes.
 */
import { categorySchema } from '../../../../validators/categorySchema';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';

export const categoriesRequestContracts = {
  listCategories: defineRequestContract({
    method: 'GET',
    path: '/api/v1/categories',
    operation: 'listCategories',
  }),

  createCategory: defineRequestContract({
    method: 'POST',
    path: '/api/v1/categories',
    operation: 'createCategory',
    body: categorySchema,
    beyondSchema: ['`code` is unique; a duplicate is a 409, not a 400.'],
  }),

  updateCategory: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/categories/{id}',
    operation: 'updateCategory',
    body: categorySchema,
    params: pathIdParams(),
    beyondSchema: [
      'A full replacement, not a merge: both `name` and `code` are required on an update.',
    ],
  }),

  deleteCategory: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/categories/{id}',
    operation: 'deleteCategory',
    params: pathIdParams(),
    beyondSchema: ['A category still referenced by products is a 409, not a 404.'],
  }),
} as const;

export const categoriesContractList = Object.values(categoriesRequestContracts);
