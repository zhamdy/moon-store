import { createFileRoute } from '@tanstack/react-router';
import { Feedback } from '@/features/customers';
import { listSearchSchema } from '@/shared/lib/listSearch';

export const Route = createFileRoute('/_authenticated/_admin/feedback')({
  validateSearch: listSearchSchema,
  component: Feedback,
});
