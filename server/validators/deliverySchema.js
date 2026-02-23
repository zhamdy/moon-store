const { z } = require('zod');

const deliveryItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

const deliverySchema = z.object({
  customer_id: z.number().int().positive().optional().nullable(),
  customer_name: z.string().min(1, 'Customer name required').max(255),
  phone: z.string().min(1, 'Phone number required').max(50),
  address: z.string().min(1, 'Address required'),
  notes: z.string().optional().nullable(),
  items: z.array(deliveryItemSchema).min(1, 'At least one item required'),
  assigned_to: z.number().int().positive().optional().nullable(),
});

const statusUpdateSchema = z.object({
  status: z.enum(['Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled']),
});

module.exports = { deliverySchema, statusUpdateSchema };
