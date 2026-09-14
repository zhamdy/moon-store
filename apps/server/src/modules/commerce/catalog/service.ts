import { PublicError } from '../../../http/errors';
import { paginationMeta } from '../../../http/pagination';
import { resolveMediaPublicOrigin } from '../../../config/env';
import { CATALOG_NOT_FOUND_MESSAGE, CATALOG_PAGE_SIZE } from './constants';
import { toCatalogCategoryDto, toCatalogCollectionDto, toCatalogProductDto } from './mappers';
import {
  CatalogRepository,
  catalogRepository,
  withCatalogReadTimeout,
  type ResolvedProductQuery,
} from './repository';
import type {
  CatalogCategoryDto,
  CatalogCollectionDto,
  CatalogProductFilters,
  CatalogProductList,
} from './types';

/** SQLSTATE `query_canceled`, which is what `statement_timeout` raises. */
const QUERY_CANCELED = '57014';

export function catalogNotFound(): PublicError {
  return new PublicError('NOT_FOUND', CATALOG_NOT_FOUND_MESSAGE);
}

/** A cancelled query is load, not a fault in the request: 503, never a pinned 500. */
export async function runCatalogRead<T>(
  fn: Parameters<typeof withCatalogReadTimeout<T>>[0],
  timeoutMs?: number
): Promise<T> {
  try {
    return await withCatalogReadTimeout(fn, timeoutMs);
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: unknown }).code === QUERY_CANCELED
    ) {
      throw new PublicError('SERVICE_UNAVAILABLE', 'The catalog is busy, please retry shortly');
    }
    throw err;
  }
}

export class CatalogService {
  constructor(private readonly repo: CatalogRepository = catalogRepository) {}

  async listProducts(filters: CatalogProductFilters): Promise<CatalogProductList> {
    const origin = resolveMediaPublicOrigin();

    return runCatalogRead(async (client) => {
      const resolved: ResolvedProductQuery = { filters };

      if (filters.scope.kind === 'category') {
        const id = await this.repo.findCategoryIdBySlug(filters.scope.slug, client);
        if (id === null) throw catalogNotFound();
        resolved.categoryId = id;
      } else if (filters.scope.kind === 'collection') {
        const id = await this.repo.findPublicCollectionIdBySlug(filters.scope.slug, client);
        if (id === null) throw catalogNotFound();
        resolved.collectionId = id;
      }

      const aggregate = await this.repo.aggregateProducts(resolved, client);
      const rows = await this.repo.listProductPage(resolved, client);
      const gallery = await this.repo.listGallery(
        rows.map((row) => row.id),
        client
      );

      const galleryByProduct = new Map<number, string[]>();
      for (const image of gallery) {
        const list = galleryByProduct.get(image.product_id) ?? [];
        list.push(image.image_url);
        galleryByProduct.set(image.product_id, list);
      }

      return {
        data: rows.map((row) =>
          toCatalogProductDto(row, galleryByProduct.get(row.id) ?? [], origin)
        ),
        meta: {
          pagination: paginationMeta(filters.page, CATALOG_PAGE_SIZE, aggregate.total),
          priceRange: { min: aggregate.minPrice, max: aggregate.maxPrice },
        },
      };
    });
  }

  async listCategories(): Promise<CatalogCategoryDto[]> {
    const rows = await runCatalogRead((client) => this.repo.listCategories(client));
    return rows.map(toCatalogCategoryDto);
  }

  async listCollections(): Promise<CatalogCollectionDto[]> {
    const origin = resolveMediaPublicOrigin();
    const rows = await runCatalogRead((client) => this.repo.listCollections(client));
    return rows.map((row) => toCatalogCollectionDto(row, origin));
  }

  async getCollection(slug: string): Promise<CatalogCollectionDto> {
    const origin = resolveMediaPublicOrigin();
    const rows = await runCatalogRead((client) => this.repo.listCollections(client, slug));
    if (rows.length === 0) throw catalogNotFound();
    return toCatalogCollectionDto(rows[0], origin);
  }
}

export const catalogService = new CatalogService();
