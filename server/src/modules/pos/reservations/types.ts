export interface CreateReservationDTO {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  source_type: 'cart' | 'delivery' | 'held';
  source_id?: string;
}

export interface ReservationRow {
  id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  source_type: string;
  source_id: string | null;
  expires_at: string;
  created_at?: string;
}
