/**
 * The shipping companies module's request contracts (#102).
 *
 * The schemas moved out of the controller: a `schemas.ts` importing its own controller
 * closes a cycle that `check:api-docs` refuses to load.
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';

export const shippingCompanySchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().nullable(),
  tracking_url_template: z.string().max(255).optional(),
  is_active: z.boolean().default(true),
});

/**
 * The update body is a genuine partial — same reasoning as #78 on collections, and this is
 * one of the modules where it was losing data today.
 *
 * `ShippingCompaniesDialog` sends `{ name, phone, website }`. Re-using the create schema
 * meant `email` and `tracking_url_template` were absent-but-valid and got written back as
 * NULL, and `is_active`'s `.default(true)` reactivated a company someone had disabled.
 */
export const shippingCompanyUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  tracking_url_template: z.string().max(255).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const shippingCompaniesRequestContracts = {
  listShippingCompanies: defineRequestContract({
    method: 'GET',
    path: '/api/v1/shipping-companies',
    operation: 'listShippingCompanies',
  }),

  createShippingCompany: defineRequestContract({
    method: 'POST',
    path: '/api/v1/shipping-companies',
    operation: 'createShippingCompany',
    body: shippingCompanySchema,
  }),

  updateShippingCompany: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/shipping-companies/{id}',
    operation: 'updateShippingCompany',
    body: shippingCompanyUpdateSchema,
    params: pathIdParams(),
    beyondSchema: [
      'PATCH-style: a field the body omits is left alone, for the reason recorded on the ' +
        'schema itself.',
    ],
  }),

  deleteShippingCompany: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/shipping-companies/{id}',
    operation: 'deleteShippingCompany',
    params: pathIdParams(),
  }),
} as const;

export const shippingCompaniesContractList = Object.values(shippingCompaniesRequestContracts);
