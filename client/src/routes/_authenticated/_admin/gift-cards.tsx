import { createFileRoute } from '@tanstack/react-router';
import { GiftCards } from '@/features/sales';

export const Route = createFileRoute('/_authenticated/_admin/gift-cards')({
  component: GiftCards,
});
