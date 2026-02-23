import { z } from 'zod';

export const saleItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unit_price: z.number().positive(),
});

export const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'At least one item required'),
  discount: z.number().min(0).default(0),
  discount_type: z.enum(['fixed', 'percentage']).default('fixed'),
  payment_method: z.enum(['Cash', 'Card', 'Other']).default('Cash'),
  customer_id: z.number().int().positive().optional().nullable(),
  points_redeemed: z.number().int().min(0).default(0),
});

export type SaleItem = z.infer<typeof saleItemSchema>;
export type Sale = z.infer<typeof saleSchema>;
