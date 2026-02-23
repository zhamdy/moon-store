const { z } = require('zod');

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name required').max(255),
  phone: z.string().min(1, 'Phone number required').max(50),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

module.exports = { customerSchema };
