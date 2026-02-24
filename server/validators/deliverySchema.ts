import { z } from 'zod';

export const deliveryItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const deliverySchema = z.object({
  customer_id: z.number().int().positive().optional().nullable(),
  customer_name: z.string().min(1, 'Customer name required').max(255),
  phone: z.string().min(1, 'Phone number required').max(50),
  address: z.string().min(1, 'Address required'),
  notes: z.string().optional().nullable(),
  items: z.array(deliveryItemSchema).min(1, 'At least one item required'),
  assigned_to: z.number().int().positive().optional().nullable(),
  estimated_delivery: z.string().optional().nullable(),
  shipping_company: z.string().max(255).optional().nullable(),
  tracking_number: z.string().max(255).optional().nullable(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(['Order Received', 'Shipping Contacted', 'In Transit', 'Delivered', 'Cancelled']),
  notes: z.string().optional().nullable(),
});

export type DeliveryItem = z.infer<typeof deliveryItemSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type StatusUpdate = z.infer<typeof statusUpdateSchema>;
