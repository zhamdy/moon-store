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
    beyondSchema: [
      '`code` is unique; a duplicate is a 409, not a 400.',
      '`slug` is optional: omitted, it is generated from `name_en`, else `code` (`base`, ' +
        '`base-2` ... `base-10`). An explicit slug already in use, or ten taken candidates, is ' +
        'a 409 with `details[].field` `slug`.',
    ],
  }),

  updateCategory: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/categories/{id}',
    operation: 'updateCategory',
    body: categorySchema,
    params: pathIdParams(),
    beyondSchema: [
      'A full replacement, not a merge: both `name` and `code` are required on an update.',
      'Except `slug`, `name_en` and `description_en`: absent leaves the stored value, and ' +
        'null clears `name_en` / `description_en`. A slug held by another category is a 409 ' +
        'with `details[].field` `slug`.',
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
