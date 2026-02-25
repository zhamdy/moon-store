import { z } from 'zod';

export const saleItemSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unit_price: z.number().positive(),
  memo: z.string().max(200).optional().nullable(),
});

const paymentEntrySchema = z.object({
  method: z.enum(['Cash', 'Card', 'Other', 'Gift Card']),
  amount: z.number().positive(),
});

export const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'At least one item required'),
  discount: z.number().min(0).default(0),
  discount_type: z.enum(['fixed', 'percentage']).default('fixed'),
  payment_method: z.enum(['Cash', 'Card', 'Other']).default('Cash'),
  payments: z.array(paymentEntrySchema).optional(),
  customer_id: z.number().int().positive().optional().nullable(),
  points_redeemed: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
  tip: z.number().min(0).default(0),
  coupon_code: z.string().optional().nullable(),
});

export type SaleItem = z.infer<typeof saleItemSchema>;
export type Sale = z.infer<typeof saleSchema>;
