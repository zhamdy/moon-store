import { createFileRoute } from '@tanstack/react-router';
import { Promotions } from '@/features/sales';
import { listSearchSchema } from '@/shared/lib/listSearch';

export const Route = createFileRoute('/_authenticated/_admin/promotions')({
  validateSearch: listSearchSchema,
  component: Promotions,
});
