import { createFileRoute } from '@tanstack/react-router';
import { Distributors } from '@/features/purchasing';

export const Route = createFileRoute('/_authenticated/_admin/distributors')({
  component: Distributors,
});
