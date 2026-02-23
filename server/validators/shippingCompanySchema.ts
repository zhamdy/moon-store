import { z } from 'zod';

export const shippingCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  phone: z.string().max(50).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
});

export type ShippingCompany = z.infer<typeof shippingCompanySchema>;
