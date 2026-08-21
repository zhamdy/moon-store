import { createFileRoute } from '@tanstack/react-router';
import { Users } from '@/features/admin';

export const Route = createFileRoute('/_authenticated/_admin/users')({
  component: Users,
});
