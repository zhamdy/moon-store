export interface SaleItemInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price?: number;
  memo?: string | null;
}

export interface PaymentInput {
  method: string;
  amount: number;
}

export interface CreateSaleDTO {
  items: SaleItemInput[];
  discount?: number;
  discount_type?: 'fixed' | 'percentage';
  payment_method: string;
  payments?: PaymentInput[];
  customer_id?: number | null;
  points_redeemed?: number;
  notes?: string | null;
  tip?: number;
  coupon_code?: string | null;
}

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  taxAmount: number;
  pointsDiscount: number;
  couponId: number | null;
  couponDiscount: number;
  tipAmount: number;
  total: number;
}

export interface TaxSettings {
  enabled: boolean;
  rate: number;
  mode: string;
}

export interface LoyaltySettings {
  enabled: boolean;
  earnRate: number;
  redeemValue: number;
}

export interface RefundItemInput {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface CreateRefundDTO {
  items: RefundItemInput[];
  reason: string;
  restock: boolean;
}

export interface SaleFilters {
  page: number;
  pageSize: number;
  search?: string;
  paymentMethod?: string;
  cashierId?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'total';
  sortOrder: 'asc' | 'desc';
}

const positiveInteger = (name: string) =>
  z
    .string()
    .regex(/^\d+$/, `${name} must be an integer`)
    .transform(Number)
    .pipe(z.number().int().positive());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

const saleListQuerySchema = z
  .object({
    page: positiveInteger('page').default('1'),
    pageSize: z.enum(['10', '25', '50', '100']).default('25').transform(Number),
    search: z.string().trim().min(1).max(100).optional(),
    paymentMethod: z.string().trim().min(1).max(40).optional(),
    cashierId: positiveInteger('cashierId').optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    sortBy: z.enum(['createdAt', 'total']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: 'dateFrom must not be after dateTo',
  });

export function parseSaleListQuery(query: unknown): SaleFilters {
  return saleListQuerySchema.parse(query);
}
import { z } from 'zod';
