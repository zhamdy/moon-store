import { z } from 'zod';

export const refundItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unit_price: z.number().positive(),
});

export const refundSchema = z.object({
  items: z.array(refundItemSchema).min(1, 'At least one item required'),
  reason: z.enum(['Customer Return', 'Cashier Error', 'Defective', 'Other']),
  restock: z.boolean().default(true),
});

export type RefundItem = z.infer<typeof refundItemSchema>;
export type Refund = z.infer<typeof refundSchema>;
