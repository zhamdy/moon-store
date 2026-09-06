import { z } from 'zod';

export interface ProductRecord {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  cost_price: number;
  stock: number;
  category?: string | null;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
  image_url?: string | null;
  status: string;
  has_variants: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProductDTO {
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  cost_price: number;
  stock: number;
  category?: string | null;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
}

export type UpdateProductDTO = CreateProductDTO;

export interface BulkUpdateDTO {
  category_id?: number;
  distributor_id?: number | null;
  price_percent?: number;
  status?: 'active' | 'inactive' | 'discontinued';
}

export interface AdjustStockDTO {
  delta: number;
  reason: string;
}

export interface VariantDTO {
  sku: string;
  barcode?: string | null;
  price?: number | null;
  cost_price: number;
  stock: number;
  attributes: Record<string, string>;
}

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  status?: 'all' | 'active' | 'inactive' | 'discontinued';
  lowStock?: boolean;
  page: number;
  pageSize: number;
  sortBy: 'name' | 'price' | 'stock' | 'category' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

const integer = (field: string) =>
  z
    .string()
    .regex(/^\d+$/, `${field} must be a positive integer`)
    .transform(Number)
    .pipe(z.number().int().positive());

export const productListQuerySchema = z
  .object({
    page: integer('page').optional(),
    pageSize: z.enum(['10', '25', '50', '100']).transform(Number).optional(),
    search: z.string().trim().max(100).optional(),
    sortBy: z.enum(['name', 'price', 'stock', 'category', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    categoryId: integer('categoryId').optional(),
    status: z.enum(['all', 'active', 'inactive', 'discontinued']).optional(),
    lowStock: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict()
  .superRefine((query, ctx) => {
    if (query.lowStock && query.status !== undefined && query.status !== 'active') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'lowStock=true requires status=active or no status',
      });
    }
  });

/**
 * Applies the defaults the schema deliberately does not.
 *
 * They live here rather than in the schema because the schema describes what a caller may
 * send and this describes what the service receives; folding the defaults in would
 * document `page` as required-with-a-default when it is simply optional on the wire.
 */
export function normalizeProductListQuery(
  query: z.infer<typeof productListQuerySchema>
): ProductFilters {
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 25,
    search: query.search || undefined,
    sortBy: query.sortBy ?? 'name',
    sortOrder: query.sortOrder ?? 'asc',
    categoryId: query.categoryId,
    status: query.status,
    lowStock: query.lowStock,
  };
}

export function parseProductListQuery(input: unknown): ProductFilters {
  return normalizeProductListQuery(productListQuerySchema.parse(input));
}

export const productLookupQuerySchema = z.object({ ids: z.string().min(1).max(1200) }).strict();

/** Splits, validates and de-duplicates the comma-separated list the schema accepts. */
export function toProductIds(raw: string): number[] {
  const ids = [
    ...new Set(
      raw.split(',').map((value) => {
        if (!/^\d+$/.test(value) || Number(value) <= 0)
          throw new z.ZodError([
            {
              code: z.ZodIssueCode.custom,
              path: ['ids'],
              message: 'IDs must be positive integers',
            },
          ]);
        return Number(value);
      })
    ),
  ].sort((a, b) => a - b);
  if (ids.length > 100)
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.too_big,
        maximum: 100,
        inclusive: true,
        exact: false,
        type: 'array',
        path: ['ids'],
        message: 'At most 100 unique IDs are allowed',
      },
    ]);
  return ids;
}

export function parseProductLookupQuery(input: unknown): { ids: number[] } {
  return { ids: toProductIds(productLookupQuerySchema.parse(input).ids) };
}
