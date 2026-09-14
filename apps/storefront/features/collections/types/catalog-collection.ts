/** `GET /api/v1/catalog/collections[/:slug]` item (KD-3). A response DTO, not a server type. */
export interface CatalogCollection {
  slug: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  season: string | null;
  year: number | null;
  /** Already absolute. */
  imageUrl: string | null;
  isFeatured: boolean;
  /** Active products only. */
  productCount: number;
}
