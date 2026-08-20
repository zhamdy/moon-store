import { createFileRoute } from '@tanstack/react-router';
import { Promotions } from '@/features/sales';

export const Route = createFileRoute('/_authenticated/_admin/promotions')({
  component: Promotions,
});
