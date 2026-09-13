export interface SegmentRecord {
  id: number;
  name: string;
  description?: string | null;
  rules_json: string;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSegmentDTO {
  name: string;
  description?: string | null;
  rules_json: string;
}

export type UpdateSegmentDTO = CreateSegmentDTO;
