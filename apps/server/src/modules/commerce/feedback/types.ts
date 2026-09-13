import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

export interface FeedbackRecord {
  id: number;
  customer_id?: number | null;
  sale_id?: number | null;
  rating: number;
  category: 'service' | 'product_quality' | 'pricing' | 'store_ambiance' | 'general';
  comment?: string | null;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
}

export interface CreateFeedbackDTO {
  customer_id?: number;
  sale_id?: number;
  rating: number;
  category?: 'service' | 'product_quality' | 'pricing' | 'store_ambiance' | 'general';
  comment?: string;
}

export interface FeedbackFilters {
  rating?: number;
  category?: CreateFeedbackDTO['category'];
  page: number;
  pageSize: number;
  sortBy: 'createdAt' | 'rating';
  sortOrder: 'asc' | 'desc';
}

export interface FeedbackStats {
  avg_rating: number | null;
  total_count: number;
  positive_count: number;
  negative_count: number;
}

export interface FeedbackListResult {
  rows: FeedbackRecord[];
  stats: FeedbackStats;
  total: number;
  page: number;
}

export const feedbackListQuerySchema = createListQuerySchema(['createdAt', 'rating'] as const)
  .extend({
    rating: z.enum(['1', '2', '3', '4', '5']).transform(Number).optional(),
    category: z
      .enum(['service', 'product_quality', 'pricing', 'store_ambiance', 'general'])
      .optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseFeedbackListQuery(query: unknown): FeedbackFilters {
  const parsed = feedbackListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    rating: parsed.rating,
    category: parsed.category,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}
