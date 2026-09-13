import { createFileRoute } from '@tanstack/react-router';
import { AuditLog } from '@/features/admin';

export const Route = createFileRoute('/_authenticated/_admin/audit-log')({
  component: AuditLog,
});
