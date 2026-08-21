export interface DistributorRecord {
  id: number;
  name: string;
  contact_info?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  product_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDistributorDTO {
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export type UpdateDistributorDTO = CreateDistributorDTO;
