const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['Admin', 'Cashier', 'Delivery']),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().nullable(),
  role: z.enum(['Admin', 'Cashier', 'Delivery']).optional(),
});

module.exports = { createUserSchema, updateUserSchema };
