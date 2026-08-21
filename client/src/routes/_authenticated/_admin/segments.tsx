import { createFileRoute } from '@tanstack/react-router';
import { Segments } from '@/features/customers';

export const Route = createFileRoute('/_authenticated/_admin/segments')({
  component: Segments,
});
