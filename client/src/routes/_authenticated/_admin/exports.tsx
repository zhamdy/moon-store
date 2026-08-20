import { createFileRoute } from '@tanstack/react-router';
import { Exports } from '@/features/analytics';

export const Route = createFileRoute('/_authenticated/_admin/exports')({
  component: Exports,
});
