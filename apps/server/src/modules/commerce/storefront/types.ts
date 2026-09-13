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

/**
 * The storefront's own settings, e.g. `store_name`, `hero_title`, `shipping_free_threshold`.
 * A flat string map for the same reason the global `settings` table is one: the set of
 * keys grows with the storefront rather than being fixed up front, and every value is a
 * string so a write is never silently coerced.
 */
export type StorefrontConfigMap = Record<string, string>;
