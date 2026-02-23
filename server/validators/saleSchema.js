const { z } = require('zod');

const saleItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unit_price: z.number().positive(),
});

const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'At least one item required'),
  discount: z.number().min(0).default(0),
  discount_type: z.enum(['fixed', 'percentage']).default('fixed'),
  payment_method: z.enum(['Cash', 'Card', 'Other']).default('Cash'),
});

module.exports = { saleSchema };
