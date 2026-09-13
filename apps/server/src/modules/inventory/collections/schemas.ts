/**
 * The collections module's request contracts (#102).
 *
 * The bodies live here rather than in the controller. They were in the controller, and
 * leaving them there to keep `collectionUpdateSchema` beside the #78 reasoning produced a
 * cycle — schemas importing the controller that imports the schemas — which every other
 * module avoids and which `check:api-docs` refused to load. The reasoning moved with the
 * schema, which is where it belonged anyway.
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { collectionListQuerySchema } from './types';

// Kept in sync with the client's `statuses` enum in Collections.tsx.
const collectionStatusSchema = z.enum(['upcoming', 'active', 'on_sale', 'archived']);

export const collectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  season: z.string().max(50).optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  status: collectionStatusSchema.optional(),
  is_featured: z.boolean().optional(),
  product_ids: z.array(z.number().int().positive()).optional(),
});

/**
 * The update body is a genuine partial, and deliberately not the create schema.
 *
 * `PUT /api/v1/collections/:id` is PATCH-style: a field the body omits is left alone, a
 * field it sets to `null` is cleared. Re-using the create schema here is what caused #78 —
 * every field was optional, so an omitted `is_featured` parsed cleanly and was then written
 * back as the default. The distinction the schema has to carry is *absent* vs *explicitly
 * null*, which is why the nullable columns are `.nullable().optional()` and `name` — a
 * NOT NULL column — is only `.optional()`.
 *
 * PATCH-style rather than requiring a whole record because the client is already written as
 * if this were true: `resource().useSave` PUTs exactly the keys a page put in its draft, so
 * every page in the app sends a partial body. Demanding a full record would have meant every
 * caller learning every column — the same coupling, moved rather than removed.
 *
 * `year` and `status` (#83): the modal has always sent both, and the server had nowhere
 * to put either — `year` had no column at all, and `status`, though it has had a column
 * since 001_initial_schema.sql, was never in this schema or in `repository.update`'s
 * write set. Zod stripped the unknown key before the repository ever saw it, so the
 * request returned a normal 200 with the change silently discarded.
 *
 * `.strict()` on this schema specifically: an unknown field is now a 400 at the moment a
 * client/schema mismatch is introduced, rather than a silent no-op discovered by a user
 * days later. Scoped to this one schema rather than repo-wide — a global sweep is its own
 * change with its own blast radius.
 */
export const collectionUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    season: z.string().max(50).nullable().optional(),
    year: z.number().int().min(1900).max(2100).nullable().optional(),
    status: collectionStatusSchema.optional(),
    is_featured: z.boolean().optional(),
    product_ids: z.array(z.number().int().positive()).optional(),
    // The `updated_at` the caller read (#81). Validated as a datetime here so a
    // malformed value is a 400 from the schema rather than a cast error from the
    // database; whether it is *current* is decided under the row lock in the service.
    expected_updated_at: z.string().datetime().optional(),
  })
  .strict();

export const collectionsRequestContracts = {
  listCollections: defineRequestContract({
    method: 'GET',
    path: '/api/v1/collections',
    operation: 'listCollections',
    query: collectionListQuerySchema,
    beyondSchema: [
      '`sortBy` defaults through a transform the generator drops, so an omitted value ' +
        'sorts rather than leaving the order undefined.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  getCollection: defineRequestContract({
    method: 'GET',
    path: '/api/v1/collections/{id}',
    operation: 'getCollection',
    params: pathIdParams(),
  }),

  createCollection: defineRequestContract({
    method: 'POST',
    path: '/api/v1/collections',
    operation: 'createCollection',
    body: collectionSchema,
    beyondSchema: [
      '`product_ids` sets the collection membership outright; omitting it creates an ' +
        'empty collection.',
    ],
  }),

  updateCollection: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/collections/{id}',
    operation: 'updateCollection',
    body: collectionUpdateSchema,
    params: pathIdParams(),
    beyondSchema: [
      'PATCH-style despite the verb: a field the body omits is left alone, and a field ' +
        'set to null is cleared. Absent and explicitly-null are different, which is why ' +
        'the nullable columns are `.nullable().optional()` while `name` is only optional.',
      '`product_ids` replaces the entire membership. A list computed against a stale ' +
        'read therefore erases whatever it never saw, which is what ' +
        '`expected_updated_at` exists to refuse: send the `updated_at` the edit was ' +
        'composed against and a concurrent change answers 409 `COLLECTION_MODIFIED`. ' +
        'Re-reading the token at submit time always matches and turns the check off.',
      'The response deliberately withholds the current token, so recovering from a 409 ' +
        'means re-reading and reviewing rather than resubmitting blind.',
    ],
  }),

  deleteCollection: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/collections/{id}',
    operation: 'deleteCollection',
    params: pathIdParams(),
  }),
} as const;

export const collectionsContractList = Object.values(collectionsRequestContracts);
