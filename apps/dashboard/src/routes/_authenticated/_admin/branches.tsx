import { createFileRoute } from '@tanstack/react-router';
import { Branches } from '@/features/admin';

export const Route = createFileRoute('/_authenticated/_admin/branches')({
  component: Branches,
});
