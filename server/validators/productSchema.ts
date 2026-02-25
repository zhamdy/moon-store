import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().max(100).optional().nullable(),
  price: z.number().positive('Price must be positive'),
  cost_price: z.number().min(0, 'Cost price cannot be negative').default(0),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  category: z.string().max(100).optional().nullable(),
  category_id: z.number().int().positive().optional().nullable(),
  distributor_id: z.number().int().positive().optional().nullable(),
  min_stock: z.number().int().min(0).default(5),
  status: z.enum(['active', 'inactive', 'discontinued']).default('active').optional(),
});

export const productImportSchema = z.array(productSchema);

export const variantSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().max(100).optional().nullable(),
  price: z.number().positive('Price must be positive').optional().nullable(),
  cost_price: z.number().min(0).default(0),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  attributes: z
    .record(z.string(), z.string())
    .refine((obj) => Object.keys(obj).length > 0, 'At least one attribute required'),
});

export const productStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'discontinued']),
});

export type Product = z.infer<typeof productSchema>;
export type ProductImport = z.infer<typeof productImportSchema>;
export type Variant = z.infer<typeof variantSchema>;
