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
  category?: string;
  page?: number;
  limit?: number;
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
  limit: number;
}
