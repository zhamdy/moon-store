import { z } from 'zod';

export const distributorSchema = z.object({
  name: z.string().min(1, 'Distributor name is required').max(255),
  contact_person: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type Distributor = z.infer<typeof distributorSchema>;
