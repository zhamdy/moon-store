/**
 * The products module's request contracts (#102).
 *
 * The largest router in the server, and the one where the four bodies declared inside the
 * controller — bulk update, bulk delete, adjust stock, batch barcodes — were invisible to
 * every consumer of the published spec.
 */
import { z } from 'zod';
import {
  productSchema,
  productStatusSchema,
  variantSchema,
} from '../../../../validators/productSchema';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { productListQuerySchema, productLookupQuerySchema } from './types';

export const bulkUpdateSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  updates: z.object({
    category_id: z.number().int().positive().optional(),
    distributor_id: z.number().int().positive().nullable().optional(),
    price_percent: z.number().min(-99).max(1000).optional(),
    status: z.enum(['active', 'inactive', 'discontinued']).optional(),
  }),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one product ID required'),
});

export const adjustStockSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Delta cannot be zero'),
  reason: z.enum(['Manual Adjustment', 'Damaged', 'Stock Count']),
});

/**
 * The import body, which is emphatically not `productImportSchema`.
 *
 * That export is `z.array(productSchema)` and nothing has ever used it. The endpoint takes
 * an *object* wrapping the array, and the rows are validated one at a time by the service,
 * which collects failures into `errors[]` and imports the rest. Contracting the rows here
 * would convert a partial-success bulk import into an all-or-nothing 400 — a real change
 * to how a shop imports a spreadsheet, bought for a tidier schema.
 */
export const productImportBodySchema = z.object({
  products: z.array(z.unknown()).min(1, 'Products array required'),
});

export const batchBarcodeSchema = z.object({
  product_ids: z.array(z.number().int().positive()).min(1),
});

/** A barcode is a printed string, not a row id, so it is not `pathIdParams`. */
export const barcodeParamsSchema = z.object({ barcode: z.string().min(1).max(100) }).strict();

export const variantPathParamsSchema = z
  .object({
    id: z.string().regex(/^\d+$/, 'id must be a positive integer'),
    variantId: z.string().regex(/^\d+$/, 'variantId must be a positive integer'),
  })
  .strict();

export type BulkUpdateBody = z.infer<typeof bulkUpdateSchema>;
export type BulkDeleteBody = z.infer<typeof bulkDeleteSchema>;
export type AdjustStockBody = z.infer<typeof adjustStockSchema>;
export type BatchBarcodeBody = z.infer<typeof batchBarcodeSchema>;
export type ProductStatusBody = z.infer<typeof productStatusSchema>;

export const productsRequestContracts = {
  listProducts: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products',
    operation: 'listProducts',
    query: productListQuerySchema,
    beyondSchema: [
      '`lowStock=true` requires `status=active` or no status at all. A cross-field rule, ' +
        'which OpenAPI cannot express and the generator drops silently.',
      'Every parameter is optional on the wire and defaulted after parsing: `page` 1, ' +
        '`pageSize` 25, `sortBy` name, `sortOrder` asc.',
      'The query is strict: a parameter not listed is rejected, not ignored.',
    ],
  }),

  lookupProducts: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products/lookup',
    operation: 'lookupProducts',
    query: productLookupQuerySchema,
    beyondSchema: [
      '`ids` is a comma-separated list of positive integers in a single string, capped ' +
        'at 1200 characters. It is de-duplicated after parsing.',
    ],
  }),

  listProductCategories: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products/categories',
    operation: 'listProductCategories',
  }),

  generateSku: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products/generate-sku/{categoryId}',
    operation: 'generateSku',
    params: pathIdParams('categoryId'),
  }),

  generateBarcode: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products/generate-barcode',
    operation: 'generateBarcode',
  }),

  getProductByBarcode: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products/barcode/{barcode}',
    operation: 'getProductByBarcode',
    params: barcodeParamsSchema,
  }),

  getProduct: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products/{id}',
    operation: 'getProduct',
    params: pathIdParams(),
  }),

  createProduct: defineRequestContract({
    method: 'POST',
    path: '/api/v1/products',
    operation: 'createProduct',
    body: productSchema,
    beyondSchema: [
      '`sku` and `barcode` are unique; a duplicate is a 409, not a 400.',
      '`cost_price` defaults to 0, `min_stock` to 5 and `status` to active when omitted.',
    ],
  }),

  bulkUpdateProducts: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/products/bulk-update',
    operation: 'bulkUpdateProducts',
    body: bulkUpdateSchema,
    beyondSchema: [
      '`price_percent` is a percentage change applied to each product, not a new price: ' +
        '-99 to 1000, so a price can be cut almost to nothing or multiplied elevenfold.',
    ],
  }),

  updateProduct: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/products/{id}',
    operation: 'updateProduct',
    body: productSchema,
    params: pathIdParams(),
    beyondSchema: ['A full replacement, not a merge: the required fields stay required.'],
  }),

  updateProductStatus: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/products/{id}/status',
    operation: 'updateProductStatus',
    body: productStatusSchema,
    params: pathIdParams(),
  }),

  deleteProduct: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/products/{id}',
    operation: 'deleteProduct',
    params: pathIdParams(),
    beyondSchema: [
      'A soft delete: the row survives with `status=discontinued`, and its SKU and ' +
        'barcode stay taken.',
    ],
  }),

  bulkDeleteProducts: defineRequestContract({
    method: 'POST',
    path: '/api/v1/products/bulk-delete',
    operation: 'bulkDeleteProducts',
    body: bulkDeleteSchema,
    beyondSchema: ['A soft delete, like the single-product one.'],
  }),

  importProducts: defineRequestContract({
    method: 'POST',
    path: '/api/v1/products/import',
    operation: 'importProducts',
    body: productImportBodySchema,
    beyondSchema: [
      'Each entry must satisfy the create-product schema, but the rows are validated ' +
        'individually and independently: a row that fails is reported in the response as ' +
        '`errors[{ row, error }]` while the rest import. The request is not rejected.',
      'An existing SKU is updated rather than duplicated, so an import is a re-import.',
    ],
  }),

  adjustProductStock: defineRequestContract({
    method: 'POST',
    path: '/api/v1/products/{id}/adjust-stock',
    operation: 'adjustProductStock',
    body: adjustStockSchema,
    params: pathIdParams(),
    beyondSchema: [
      '`delta` is a relative change and may not be zero; send -3 to remove three.',
      'An adjustment that would take stock below zero is refused by the service.',
    ],
  }),

  getStockHistory: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products/{id}/stock-history',
    operation: 'getStockHistory',
    params: pathIdParams(),
  }),

  uploadProductImage: defineRequestContract({
    method: 'POST',
    path: '/api/v1/products/{id}/image',
    operation: 'uploadProductImage',
    params: pathIdParams(),
    contentType: 'multipart/form-data',
    beyondSchema: [
      'A single file field named `image`. Not JSON.',
      'At most 2 MB, JPEG, PNG or WebP, and the magic bytes must agree with the ' +
        'extension — a renamed file is rejected before anything is written.',
      'The file is validated and stored before the row is updated, so a failure leaves a ' +
        'temporary orphan rather than a broken image.',
    ],
  }),

  deleteProductImage: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/products/{id}/image',
    operation: 'deleteProductImage',
    params: pathIdParams(),
    beyondSchema: ['The stored object is released only after the row stops pointing at it.'],
  }),

  listVariants: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products/{id}/variants',
    operation: 'listVariants',
    params: pathIdParams(),
  }),

  createVariant: defineRequestContract({
    method: 'POST',
    path: '/api/v1/products/{id}/variants',
    operation: 'createVariant',
    body: variantSchema,
    params: pathIdParams(),
    beyondSchema: [
      '`attributes` is a string-to-string map and must not be empty — a variant with no ' +
        'attributes is indistinguishable from its product.',
      'A variant `sku` shares the uniqueness constraint with product SKUs.',
    ],
  }),

  updateVariant: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/products/{id}/variants/{variantId}',
    operation: 'updateVariant',
    body: variantSchema,
    params: variantPathParamsSchema,
    beyondSchema: ['A full replacement of the variant, not a merge.'],
  }),

  deleteVariant: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/products/{id}/variants/{variantId}',
    operation: 'deleteVariant',
    params: variantPathParamsSchema,
  }),

  getPriceHistory: defineRequestContract({
    method: 'GET',
    path: '/api/v1/products/{id}/price-history',
    operation: 'getPriceHistory',
    params: pathIdParams(),
  }),

  batchGenerateBarcodes: defineRequestContract({
    method: 'POST',
    path: '/api/v1/products/batch-generate-barcodes',
    operation: 'batchGenerateBarcodes',
    body: batchBarcodeSchema,
  }),
} as const;

export const productsContractList = Object.values(productsRequestContracts);
