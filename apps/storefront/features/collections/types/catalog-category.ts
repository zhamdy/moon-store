/** `GET /api/v1/catalog/categories` item (KD-3). A response DTO, not a server type. */
export interface CatalogCategory {
  slug: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  /** Active products only; a zero count is listed, not omitted. */
  productCount: number;
}
