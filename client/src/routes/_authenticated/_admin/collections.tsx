import { createFileRoute } from '@tanstack/react-router';
import { Collections } from '@/features/inventory';

export const Route = createFileRoute('/_authenticated/_admin/collections')({
  component: Collections,
});
