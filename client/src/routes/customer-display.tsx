import { createFileRoute } from '@tanstack/react-router';
import { CustomerDisplay } from '@/features/pos';

export const Route = createFileRoute('/customer-display')({
  component: CustomerDisplay,
});
