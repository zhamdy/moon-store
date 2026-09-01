import { createFileRoute } from '@tanstack/react-router';
import { Warranty } from '@/features/customers';

export const Route = createFileRoute('/_authenticated/_admin/warranty')({
  component: Warranty,
});
