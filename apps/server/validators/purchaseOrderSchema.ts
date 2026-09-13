import { z } from 'zod';

export const poItemSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  cost_price: z.number().min(0),
});

export const purchaseOrderSchema = z.object({
  distributor_id: z.number().int().positive(),
  items: z.array(poItemSchema).min(1, 'At least one item required'),
  notes: z.string().optional().nullable(),
});

export const receiveItemSchema = z.object({
  item_id: z.number().int().positive(),
  quantity: z.number().int().min(0),
});

export const receiveSchema = z.object({
  items: z.array(receiveItemSchema).min(1, 'At least one item required'),
});

export type POItem = z.infer<typeof poItemSchema>;
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;
export type ReceiveItems = z.infer<typeof receiveSchema>;
