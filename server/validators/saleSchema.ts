import { z } from 'zod';

export const saleItemSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unit_price: z.number().positive(),
  memo: z.string().max(200).optional().nullable(),
});

// Split-payment integrity (Unit 4 of the checkout total-parity plan, #49):
// see server/src/modules/pos/sales/types.ts for the full documented policy
// (supported methods, duplicate-method policy, zero-due behavior, and the
// "payments is the sole source of truth when present" ambiguity resolution).
// These bounds are deterministic Zod-boundary rejections, distinct from the
// service-level SPLIT_PAYMENT_MISMATCH sum-equality check.
export const MAX_PAYMENT_ENTRIES = 10;
/** Sanity ceiling per entry, in EGP major units -- not a business limit, just a defensive bound against absurd/overflow-prone input. */
export const MAX_PAYMENT_AMOUNT_MAJOR = 1_000_000;

function hasAtMostTwoDecimalPlaces(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

export const paymentEntrySchema = z.object({
  method: z.enum(['Cash', 'Card', 'Other', 'Gift Card']),
  amount: z
    .number()
    .finite('Payment amount must be finite')
    // Zero is allowed (not just positive): a fully-comped/zero-due sale may
    // record an explicit zero-amount entry; a negative amount is always
    // rejected. See types.ts "Zero-due sales" policy.
    .nonnegative('Payment amount cannot be negative')
    .max(MAX_PAYMENT_AMOUNT_MAJOR, `Payment amount cannot exceed ${MAX_PAYMENT_AMOUNT_MAJOR}`)
    .refine(hasAtMostTwoDecimalPlaces, 'Payment amount cannot have more than 2 decimal places'),
});

export const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'At least one item required'),
  discount: z.number().min(0).default(0),
  discount_type: z.enum(['fixed', 'percentage']).default('fixed'),
  payment_method: z.enum(['Cash', 'Card', 'Other']).default('Cash'),
  // When present (even with exactly one entry), this array is the sole
  // source of truth for split tender and must sum, in exact integer minor
  // units, to the server-authoritative amount due (SalesService,
  // SPLIT_PAYMENT_MISMATCH). An empty array is rejected here as ambiguous.
  payments: z
    .array(paymentEntrySchema)
    .min(1, 'Split payment entries cannot be empty')
    .max(MAX_PAYMENT_ENTRIES, `A sale cannot have more than ${MAX_PAYMENT_ENTRIES} payment entries`)
    .optional(),
  customer_id: z.number().int().positive().optional().nullable(),
  points_redeemed: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
  tip: z
    .number()
    .finite('Tip must be finite')
    .min(0)
    .max(MAX_PAYMENT_AMOUNT_MAJOR, `Tip cannot exceed ${MAX_PAYMENT_AMOUNT_MAJOR}`)
    .default(0),
  coupon_code: z.string().optional().nullable(),
});

export const refundItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unit_price: z.number().positive(),
});

export const refundSchema = z.object({
  items: z.array(refundItemSchema).min(1, 'At least one item required'),
  reason: z.string().min(1, 'Reason is required').max(500),
  restock: z.boolean().default(true),
});

export type SaleItem = z.infer<typeof saleItemSchema>;
export type Sale = z.infer<typeof saleSchema>;
export type RefundItem = z.infer<typeof refundItemSchema>;
export type Refund = z.infer<typeof refundSchema>;
