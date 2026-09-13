import { createFileRoute } from '@tanstack/react-router';
import { ReportBuilder } from '@/features/analytics';

export const Route = createFileRoute('/_authenticated/_admin/report-builder')({
  component: ReportBuilder,
});
