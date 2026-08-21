import { createFileRoute } from '@tanstack/react-router';
import { PurchaseOrders } from '@/features/purchasing';

export const Route = createFileRoute('/_authenticated/_admin/purchase-orders')({
  component: PurchaseOrders,
});
