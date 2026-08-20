import { createFileRoute } from '@tanstack/react-router';
import { Categories } from '@/features/inventory';

export const Route = createFileRoute('/_authenticated/_admin/categories')({
  component: Categories,
});
