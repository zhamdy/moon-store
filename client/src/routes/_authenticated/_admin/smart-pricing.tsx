import { createFileRoute } from '@tanstack/react-router';
import { SmartPricing } from '@/features/inventory';

export const Route = createFileRoute('/_authenticated/_admin/smart-pricing')({
  component: SmartPricing,
});
