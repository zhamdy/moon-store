import {
  generateSku,
  generateBarcode,
  createProduct,
  updateProduct,
  bulkDeleteProducts,
  bulkUpdateProducts,
  importProducts,
  adjustStock,
  createVariant,
  updateVariant,
  deleteVariant,
  batchGenerateBarcodes,
} from '../../../../services/productService';
import { IProductsRepository, productsRepository as defaultRepo } from './repository';
import { ProductFilters } from './types';
import { withTransaction } from '../../../database/transaction';

export class ProductsService {
  constructor(private repo: IProductsRepository = defaultRepo) {}

  getRepository(): IProductsRepository {
    return this.repo;
  }

  list(filters: ProductFilters) {
    return withTransaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      return this.repo.list(filters, client);
    });
  }

  lookup(ids: number[], includeInactive: boolean) {
    return this.repo.lookup(ids, includeInactive);
  }

  generateSku(categoryId: number) {
    return generateSku(categoryId);
  }

  generateBarcode() {
    return generateBarcode();
  }

  createProduct(data: any) {
    return createProduct(data);
  }

  updateProduct(id: string | number, data: any, userId: number) {
    return updateProduct(id, data, userId);
  }

  bulkDeleteProducts(ids: number[]) {
    return bulkDeleteProducts(ids);
  }

  bulkUpdateProducts(ids: number[], updates: any) {
    return bulkUpdateProducts(ids, updates);
  }

  importProducts(products: unknown[]) {
    return importProducts(products);
  }

  adjustStock(productId: number, input: any, userId: number) {
    return adjustStock(productId, input, userId);
  }

  createVariant(productId: number, data: any) {
    return createVariant(productId, data);
  }

  updateVariant(productId: string | number, variantId: string | number, data: any) {
    return updateVariant(productId, variantId, data);
  }

  deleteVariant(productId: string | number, variantId: string | number) {
    return deleteVariant(productId, variantId);
  }

  batchGenerateBarcodes(productIds: number[]) {
    return batchGenerateBarcodes(productIds);
  }
}

export const productsService = new ProductsService();
