import { createFileRoute } from '@tanstack/react-router';
import { AdvancedAnalytics } from '@/features/analytics';

export const Route = createFileRoute('/_authenticated/_admin/analytics')({
  component: AdvancedAnalytics,
});
