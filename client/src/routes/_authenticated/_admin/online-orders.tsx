import { createFileRoute } from '@tanstack/react-router';
import { OnlineOrders } from '@/features/fulfillment';

export const Route = createFileRoute('/_authenticated/_admin/online-orders')({
  component: OnlineOrders,
});
