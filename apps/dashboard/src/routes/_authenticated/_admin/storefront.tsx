import { createFileRoute } from '@tanstack/react-router';
import { Storefront } from '@/features/fulfillment';

export const Route = createFileRoute('/_authenticated/_admin/storefront')({
  component: Storefront,
});
