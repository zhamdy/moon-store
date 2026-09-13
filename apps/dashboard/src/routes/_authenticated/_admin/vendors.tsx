import { createFileRoute } from '@tanstack/react-router';
import { Vendors } from '@/features/purchasing';
import { listSearchSchema, optionalListStatus } from '@/shared/lib/listSearch';

export const vendorSearchSchema = listSearchSchema.extend({
  status: optionalListStatus(['pending', 'active', 'suspended'] as const),
});

export const Route = createFileRoute('/_authenticated/_admin/vendors')({
  validateSearch: vendorSearchSchema,
  component: Vendors,
});
