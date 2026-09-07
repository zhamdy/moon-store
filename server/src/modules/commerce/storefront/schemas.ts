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

export const storefrontRequestContracts = {
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
