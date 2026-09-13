import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/features/analytics';

export const Route = createFileRoute('/_authenticated/_admin/')({
  component: Dashboard,
});
