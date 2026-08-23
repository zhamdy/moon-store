import { createFileRoute } from '@tanstack/react-router';
import { Customers } from '@/features/customers';
import { listSearchSchema } from '@/shared/lib/listSearch';

export const Route = createFileRoute('/_authenticated/_admin/customers')({
  validateSearch: listSearchSchema,
  component: Customers,
});
