import { createFileRoute } from '@tanstack/react-router';
import { OnlineOrders } from '@/features/fulfillment';
import { listSearchSchema } from '@/shared/lib/listSearch';
import { z } from 'zod';

export const onlineOrderSearchSchema = listSearchSchema.extend({
  status: z
    .enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute('/_authenticated/_admin/online-orders')({
  validateSearch: onlineOrderSearchSchema,
  component: OnlineOrders,
});
