import { createFileRoute } from '@tanstack/react-router';
import { Feedback } from '@/features/customers';

export const Route = createFileRoute('/_authenticated/_admin/feedback')({
  component: Feedback,
});
