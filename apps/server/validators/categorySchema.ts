import { z } from 'zod';
import { slugSchema } from '../src/modules/inventory/shared/slug';

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(255),
  code: z.string().min(1, 'Category code is required').max(50),
  // Absent on create means "generate one"; absent on update means "leave it" (KD-6).
  slug: slugSchema.optional(),
  // Absent on update leaves the stored value; null clears it (KD-7).
  name_en: z.string().max(255).nullable().optional(),
  description_en: z.string().max(1000).nullable().optional(),
});

export type Category = z.infer<typeof categorySchema>;
