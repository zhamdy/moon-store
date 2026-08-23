import { createFileRoute } from '@tanstack/react-router';
import { GiftCards } from '@/features/sales';
import { listSearchSchema } from '@/shared/lib/listSearch';
import { z } from 'zod';

export const giftCardSearchSchema = listSearchSchema.extend({
  search: z.string().trim().max(100).optional().catch(undefined),
});

export const Route = createFileRoute('/_authenticated/_admin/gift-cards')({
  validateSearch: giftCardSearchSchema,
  component: GiftCards,
});
