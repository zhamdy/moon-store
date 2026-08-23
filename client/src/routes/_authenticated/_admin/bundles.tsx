import { createFileRoute } from '@tanstack/react-router';
import { Bundles } from '@/features/inventory';
import { listSearchSchema } from '@/shared/lib/listSearch';

export const Route = createFileRoute('/_authenticated/_admin/bundles')({
  validateSearch: listSearchSchema,
  component: Bundles,
});
