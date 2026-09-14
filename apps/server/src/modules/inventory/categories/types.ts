export interface CategoryRecord {
  id: number;
  name: string;
  code: string;
  slug?: string | null;
  name_en?: string | null;
  description_en?: string | null;
  product_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCategoryDTO {
  name: string;
  code: string;
  slug?: string;
  name_en?: string | null;
  description_en?: string | null;
}

/**
 * `name` and `code` are replaced; `slug`, `name_en` and `description_en` are left alone
 * when absent, so a client that predates them cannot wipe them.
 */
export type UpdateCategoryDTO = CreateCategoryDTO;
