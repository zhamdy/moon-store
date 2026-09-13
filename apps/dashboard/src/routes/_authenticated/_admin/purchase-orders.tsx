import { createFileRoute } from '@tanstack/react-router';
import { PurchaseOrders } from '@/features/purchasing';
import { listSearchSchema } from '@/shared/lib/listSearch';
import { z } from 'zod';

export const purchaseOrderSearchSchema = listSearchSchema.extend({
  status: z.string().trim().max(30).catch('All'),
  distributorId: z.preprocess(
    (value) => (value === undefined || value === '' || value === 'all' ? 'all' : String(value)),
    z.union([z.literal('all'), z.string().regex(/^\d+$/)]).catch('all')
  ),
});

export const Route = createFileRoute('/_authenticated/_admin/purchase-orders')({
  validateSearch: purchaseOrderSearchSchema,
  component: PurchaseOrders,
});
