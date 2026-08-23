import { createFileRoute } from '@tanstack/react-router';
import { StockCount } from '@/features/inventory';
import { listSearchSchema } from '@/shared/lib/listSearch';

export const Route = createFileRoute('/_authenticated/_admin/stock-count')({
  validateSearch: listSearchSchema,
  component: StockCount,
});
