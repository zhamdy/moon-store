import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(255),
  code: z.string().min(1, 'Category code is required').max(50),
});

export type Category = z.infer<typeof categorySchema>;
