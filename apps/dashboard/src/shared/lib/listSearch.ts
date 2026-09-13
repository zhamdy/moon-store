import { z } from 'zod';

export const pageSearch = z.preprocess(
  (value) => Number(value ?? 1),
  z.number().int().positive().catch(1)
);

export const pageSizeSearch = z.preprocess(
  (value) => Number(value ?? 25),
  z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]).catch(25)
);

export const listSearchSchema = z.object({
  page: pageSearch,
  pageSize: pageSizeSearch,
});

export const optionalListStatus = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);
