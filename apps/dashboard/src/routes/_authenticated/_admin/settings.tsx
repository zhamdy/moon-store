import { createFileRoute } from '@tanstack/react-router';
import { Settings } from '@/features/admin';

export const Route = createFileRoute('/_authenticated/_admin/settings')({
  component: Settings,
});
