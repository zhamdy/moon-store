const { z } = require('zod');

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().max(100).optional().nullable(),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  category: z.string().max(100).optional().nullable(),
  min_stock: z.number().int().min(0).default(5),
});

const productImportSchema = z.array(productSchema);

module.exports = { productSchema, productImportSchema };
