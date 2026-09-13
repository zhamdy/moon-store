export interface CategoryRecord {
  id: number;
  name: string;
  code: string;
  product_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCategoryDTO {
  name: string;
  code: string;
}

export type UpdateCategoryDTO = CreateCategoryDTO;
