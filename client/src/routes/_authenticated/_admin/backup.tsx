import { createFileRoute } from '@tanstack/react-router';
import { Backup } from '@/features/admin';

export const Route = createFileRoute('/_authenticated/_admin/backup')({
  component: Backup,
});
