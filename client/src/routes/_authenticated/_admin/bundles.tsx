import { createFileRoute } from '@tanstack/react-router';
import { Bundles } from '@/features/inventory';

export const Route = createFileRoute('/_authenticated/_admin/bundles')({
  component: Bundles,
});
