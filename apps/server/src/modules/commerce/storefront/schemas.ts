/**
 * The storefront module's request contracts (#102).
 *
 * The schemas moved out of the controller. A `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load, even where vitest does not care.
 */
import { z } from 'zod';
import { getStorage } from '../../../storage';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';

/**
 * A banner image is either somebody else's absolute URL or a path into this deployment's
 * own media store. The store is asked rather than a `/uploads/` prefix being hard-coded,
 * so a deployment that moves its media keeps accepting the URLs it now hands out.
 */
function isStoredOrAbsoluteUrl(value: string): boolean {
  if (z.string().url().safeParse(value).success) return true;
  return getStorage().keyFromUrl(value) !== null;
}

export const bannerSchema = z.object({
  title: z.string().min(1).max(100),
  subtitle: z.string().max(255).optional(),
  image_url: z
    .string()
    .min(1)
    .max(1000)
    .refine(
      isStoredOrAbsoluteUrl,
      'image_url must be an absolute URL or a path in the media store'
    ),
  link_url: z.string().max(255).optional(),
  position: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

/**
 * The storefront's own settings. A flat string map, like the global `settings` write: a
 * fixed set of known fields rather than `z.record`, because the dashboard's config form
 * only ever writes these, and a typo in a key is a schema rejection rather than a value
 * silently stored under a key nothing reads back.
 */
export const storefrontConfigSchema = z
  .object({
    store_name: z.string().max(200).optional(),
    store_description: z.string().max(2000).optional(),
    hero_title: z.string().max(200).optional(),
    hero_subtitle: z.string().max(500).optional(),
    shipping_free_threshold: z.string().max(30).optional(),
    shipping_standard_rate: z.string().max(30).optional(),
    shipping_express_rate: z.string().max(30).optional(),
    return_policy_days: z.string().max(10).optional(),
    featured_category: z.string().max(100).optional(),
    storefront_enabled: z.string().max(10).optional(),
  })
  .strict();

export const storefrontRequestContracts = {
  getStorefrontConfig: defineRequestContract({
    method: 'GET',
    path: '/api/v1/storefront/config',
    operation: 'getStorefrontConfig',
    beyondSchema: [
      'Admin-only while Storefront is postponed. Folds the storefront_config_* rows out ' +
        'of the settings table into one flat object; absent keys are simply not in the ' +
        'response rather than present with a default value.',
    ],
  }),

  updateStorefrontConfig: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/storefront/config',
    operation: 'updateStorefrontConfig',
    body: storefrontConfigSchema,
    beyondSchema: [
      'The write is a merge: keys absent from the body keep their stored value, the same ' +
        'contract PUT /api/v1/settings makes for the global settings it shares a table with.',
    ],
  }),

  listPublicBanners: defineRequestContract({
    method: 'GET',
    path: '/api/v1/storefront/banners',
    operation: 'listPublicBanners',
    beyondSchema: [
      'Public and unauthenticated: returns only banners that are active now, which is ' +
        'what makes it safe to serve to a shopper.',
    ],
  }),

  listAllBanners: defineRequestContract({
    method: 'GET',
    path: '/api/v1/storefront/banners/all',
    operation: 'listAllBanners',
    beyondSchema: ['Admin: includes scheduled and expired banners.'],
  }),

  createBanner: defineRequestContract({
    method: 'POST',
    path: '/api/v1/storefront/banners',
    operation: 'createBanner',
    body: bannerSchema,
  }),

  updateBanner: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/storefront/banners/{id}',
    operation: 'updateBanner',
    body: bannerSchema,
    params: pathIdParams(),
    beyondSchema: ['A full replacement, not a merge.'],
  }),

  deleteBanner: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/storefront/banners/{id}',
    operation: 'deleteBanner',
    params: pathIdParams(),
  }),
} as const;

export const storefrontContractList = Object.values(storefrontRequestContracts);
