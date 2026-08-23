import { z } from 'zod';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function paginationMeta(page: number, pageSize: number, totalItems: number): PaginationMeta {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}

const strictInteger = (name: string) =>
  z
    .string()
    .regex(/^\d+$/, `${name} must be an integer`)
    .transform(Number)
    .pipe(z.number().int().positive());

export function createListQuerySchema<const T extends readonly [string, ...string[]]>(
  sortFields: T
) {
  return z
    .object({
      page: strictInteger('page').default('1'),
      pageSize: z.enum(['10', '25', '50', '100']).default('25').transform(Number),
      sortBy: z.enum(sortFields).optional(),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
    })
    .strict();
}
