// Types owned by the customers slice. Cross-slice contracts (Customer,
// AppSettings, ...) live in `shared/types` instead.

/** One RFM segment's roll-up from GET /api/segments */
export interface SegmentSummary {
  segment: string;
  count: number;
  total_revenue: number;
  avg_frequency: number;
}

/** A customer scored on recency/frequency/monetary, from GET /api/segments */
export interface CustomerRFM {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  recency_days: number;
  frequency: number;
  monetary: number;
  segment: string;
  loyalty_points: number;
}

/** Body of GET /api/segments */
export interface SegmentsResponse {
  customers: CustomerRFM[];
  summary: SegmentSummary[];
}

/** One survey response from GET /api/feedback */
export interface FeedbackEntry {
  id: number;
  sale_id: number | null;
  customer_name: string | null;
  rating: number | null;
  nps_score: number | null;
  comment: string | null;
  created_at: string;
}

/** Aggregate satisfaction figures returned beside the feedback list */
export interface FeedbackStats {
  avg_rating: number | null;
  total_responses: number;
  nps_score: number | null;
}

/** Body of GET /api/feedback */
export interface FeedbackResponse {
  feedback: FeedbackEntry[];
  stats: FeedbackStats;
}

/**
 * The seven values `warranty_claims.status` allows. The column carries a CHECK
 * constraint over exactly this set, so it is the database's vocabulary rather
 * than a client-side convention, and widening it here would only move the
 * rejection from the type checker to a 500 at runtime.
 */
export type WarrantyStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'resolved'
  | 'replaced'
  | 'refunded';

/** Warranty claim from GET /api/warranty */
export interface WarrantyClaim {
  id: number;
  /** Null when the claim was filed before its original sale was located. */
  sale_id: number | null;
  product_id: number;
  product_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  issue_description: string;
  status: WarrantyStatus;
  resolution: string | null;
  created_at: string;
}
