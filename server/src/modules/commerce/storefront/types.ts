export interface BannerRecord {
  id: number;
  title: string;
  subtitle?: string | null;
  image_url: string;
  link_url?: string | null;
  position: number;
  is_active: number | boolean;
  created_at: string;
  updated_at?: string;
}

export interface BannerDTO {
  title: string;
  subtitle?: string | null;
  image_url: string;
  link_url?: string | null;
  position?: number;
  is_active?: boolean;
}
