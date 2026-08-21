import { createFileRoute } from '@tanstack/react-router';
import { Vendors } from '@/features/purchasing';

export const Route = createFileRoute('/_authenticated/_admin/vendors')({
  component: Vendors,
});
