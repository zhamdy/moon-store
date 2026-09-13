import { createFileRoute } from '@tanstack/react-router';
import { AiInsights } from '@/features/analytics';

export const Route = createFileRoute('/_authenticated/_admin/ai-insights')({
  component: AiInsights,
});
