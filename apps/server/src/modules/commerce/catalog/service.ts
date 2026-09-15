import { PublicError } from '../../../http/errors';
import { paginationMeta } from '../../../http/pagination';
import { resolveMediaPublicOrigin } from '../../../config/env';
import logger from '../../../../lib/logger';
import {
  CATALOG_NOT_FOUND_MESSAGE,
  CATALOG_PAGE_SIZE,
  STORE_POLICY_SETTING_KEYS,
} from './constants';
import {
  deriveVariantOptions,
  rowHasVariants,
  toCatalogCategoryDto,
  toCatalogCollectionDto,
  toCatalogProductDetailDto,
  toCatalogProductDto,
} from './mappers';
import {
  CatalogRepository,
  catalogRepository,
  withCatalogReadTimeout,
  type ResolvedProductQuery,
} from './repository';
import type {
  CatalogCategoryDto,
  CatalogCollectionDto,
  CatalogProductDetailDto,
  CatalogProductFilters,
  CatalogProductList,
  CatalogStorePoliciesDto,
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

  async getProduct(slug: string): Promise<CatalogProductDetailDto> {
    const origin = resolveMediaPublicOrigin();

    const read = await runCatalogRead(async (client) => {
      const row = await this.repo.findPublicProductBySlug(slug, client);
      if (row === null) throw catalogNotFound();
      const gallery = await this.repo.listGallery([row.id], client);
      const variants = await this.repo.listVariants(row.id, client);
      const collections = await this.repo.listProductCollections(row.id, client);
      return { row, gallery, variants, collections };
    });

    const hasVariants = rowHasVariants(read.row);
    const derived = hasVariants
      ? deriveVariantOptions(read.variants, read.row.price)
      : { options: [], variants: [], droppedVariantIds: [] };
    if (derived.droppedVariantIds.length > 0) {
      logger.warn('Catalog product detail dropped unusable variants', {
        product_slug: slug,
        variant_ids: derived.droppedVariantIds,
      });
    }

    return toCatalogProductDetailDto(
      read.row,
      read.gallery.map((image) => image.image_url),
      derived,
      read.collections,
      origin
    );
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

  async getStorePolicies(): Promise<CatalogStorePoliciesDto> {
    const rows = await runCatalogRead((client) => this.repo.listStorePolicySettings(client));
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const text = (key: string): string | null => {
      const value = byKey.get(key);
      return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
    };
    return {
      delivery: text(STORE_POLICY_SETTING_KEYS.delivery),
      deliveryEn: text(STORE_POLICY_SETTING_KEYS.deliveryEn),
      returns: text(STORE_POLICY_SETTING_KEYS.returns),
      returnsEn: text(STORE_POLICY_SETTING_KEYS.returnsEn),
    };
  }

  async getCollection(slug: string): Promise<CatalogCollectionDto> {
    const origin = resolveMediaPublicOrigin();
    const rows = await runCatalogRead((client) => this.repo.listCollections(client, slug));
    if (rows.length === 0) throw catalogNotFound();
    return toCatalogCollectionDto(rows[0], origin);
  }
}

export const catalogService = new CatalogService();
