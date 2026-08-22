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
  legacyQuery?: boolean;
}

const integer = (field: string) =>
  z
    .string()
    .regex(/^\d+$/, `${field} must be a positive integer`)
    .transform(Number)
    .pipe(z.number().int().positive());

const rawListQuery = z
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
    limit: integer('limit').pipe(z.number().max(500)).optional(),
    sort: z.enum(['name', 'price', 'stock', 'category', 'created_at']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    category_id: integer('category_id').optional(),
  })
  .strict()
  .superRefine((query, ctx) => {
    for (const [canonical, legacy] of [
      ['pageSize', 'limit'],
      ['sortBy', 'sort'],
      ['sortOrder', 'order'],
      ['categoryId', 'category_id'],
    ] as const) {
      if (query[canonical] !== undefined && query[legacy] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [canonical],
          message: `Cannot combine ${canonical} with ${legacy}`,
        });
      }
    }
    if (query.lowStock && query.status !== undefined && query.status !== 'active') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'lowStock=true requires status=active or no status',
      });
    }
  });

export function parseProductListQuery(input: unknown): ProductFilters {
  const query = rawListQuery.parse(input);
  const legacyQuery =
    query.limit !== undefined ||
    query.sort !== undefined ||
    query.order !== undefined ||
    query.category_id !== undefined;
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? query.limit ?? 25,
    search: query.search || undefined,
    sortBy: query.sortBy ?? (query.sort === 'created_at' ? 'createdAt' : query.sort) ?? 'name',
    sortOrder: query.sortOrder ?? query.order ?? 'asc',
    categoryId: query.categoryId ?? query.category_id,
    status: query.status,
    lowStock: query.lowStock,
    ...(legacyQuery ? { legacyQuery: true } : {}),
  };
}

const lookupQuery = z.object({ ids: z.string().min(1).max(1200) }).strict();

export function parseProductLookupQuery(input: unknown): { ids: number[] } {
  const { ids: raw } = lookupQuery.parse(input);
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
  return { ids };
}
