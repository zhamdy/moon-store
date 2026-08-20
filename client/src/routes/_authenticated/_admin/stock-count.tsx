import { createFileRoute } from '@tanstack/react-router';
import { StockCount } from '@/features/inventory';

export const Route = createFileRoute('/_authenticated/_admin/stock-count')({
  component: StockCount,
});
