import { Request, Response, NextFunction } from 'express';
import logger from '../../../../lib/logger';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import type { Product, Variant } from '../../../../validators/productSchema';
import { productsService } from './service';
import { productsRepository } from './repository';
import { z } from 'zod';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';
import { normalizeProductListQuery, toProductIds } from './types';
import { getStorage, productImageKey } from '../../../storage';
import { isUniqueViolation } from '../../../database/constraintErrors';
import {
  productsRequestContracts,
  type AdjustStockBody,
  type BatchBarcodeBody,
  type BulkDeleteBody,
  type BulkUpdateBody,
  type ProductStatusBody,
} from './schemas';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = productsRequestContracts;

export class ProductsController {
  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = normalizeProductListQuery(contracts.listProducts.parseQuery(req.query));
      const role = (req as AuthRequest).user?.role;
      if (query.lowStock && role !== 'Admin') {
        throw new PublicError('FORBIDDEN');
      }
      const result = await productsService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async lookup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ids = toProductIds(contracts.lookupProducts.parseQuery<{ ids: string }>(req.query).ids);
      const rows = await productsService.lookup(ids, (req as AuthRequest).user?.role === 'Admin');
      res.json(success(rows));
    } catch (err) {
      next(err);
    }
  }

  async getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await productsRepository.listCategories();
      res.json(success(categories));
    } catch (err) {
      next(err);
    }
  }

  async generateSku(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { categoryId } = contracts.generateSku.parseParams<{ categoryId: string }>(req.params);
      const result = await productsService.generateSku(Number(categoryId));
      if (!result) {
        throw new PublicError('NOT_FOUND', 'Category not found');
      }
      res.json(success(result));
    } catch (err) {
      next(err);
    }
  }

  async generateBarcode(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productsService.generateBarcode();
      res.json(success(result));
    } catch (err) {
      next(err);
    }
  }

  async getByBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { barcode } = contracts.getProductByBarcode.parseParams<{ barcode: string }>(
        req.params
      );
      const product = await productsRepository.findByBarcode(barcode);
      if (product) {
        res.json(success(product));
        return;
      }

      const variant = await productsRepository.findVariantByBarcode(barcode);
      if (variant) {
        res.json(
          success({
            id: variant.product_id,
            name: variant.product_name,
            sku: variant.sku,
            barcode: variant.barcode,
            price: variant.price,
            stock: variant.stock,
            category: variant.category,
            category_id: variant.category_id,
            image_url: variant.image_url,
            variant_id: variant.id,
            variant_attributes:
              typeof variant.attributes === 'string'
                ? JSON.parse(variant.attributes || '{}')
                : variant.attributes,
          })
        );
        return;
      }

      throw new PublicError('NOT_FOUND', 'Product not found');
    } catch (err) {
      next(err);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.getProduct.parseParams<{ id: string }>(req.params);
      const product = await productsRepository.findById(id);
      if (!product) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }
      res.json(success(product));
    } catch (err) {
      next(err);
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createProduct.parseBody<Product>(req.body);

      const product = await productsService.createProduct(parsed);
      logAuditFromReq(req, 'create', 'product', product?.id, {
        name: parsed.name,
        sku: parsed.sku,
        price: parsed.price,
      });
      res.status(201).json(success(product));
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'SKU or barcode already exists'));
        return;
      }
      next(err);
    }
  }

  async bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.bulkUpdateProducts.parseBody<BulkUpdateBody>(req.body);

      const { ids, updates } = parsed;
      const updated = await productsService.bulkUpdateProducts(ids, updates);
      res.json(success({ updated }));
    } catch (err: any) {
      // Typed at the throw site (#47).
      next(err);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.updateProduct.parseParams<{ id: string }>(req.params);
      const parsed = contracts.updateProduct.parseBody<Product>(req.body);

      const authReq = req as AuthRequest;
      const product = await productsService.updateProduct(id, parsed, authReq.user!.id);

      if (!product) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }

      logAuditFromReq(req, 'update', 'product', id);
      res.json(success(product));
    } catch (err: any) {
      if (err.type === 'discontinued') {
        next(new PublicError('FORBIDDEN', err.message));
        return;
      }
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'SKU or barcode already exists'));
        return;
      }
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.updateProductStatus.parseParams<{ id: string }>(req.params);
      const parsed = contracts.updateProductStatus.parseBody<ProductStatusBody>(req.body);

      const { status } = parsed;
      const product = await productsRepository.updateStatus(id, status);

      if (!product) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }

      logAuditFromReq(req, 'status_change', 'product', id, { status });
      res.json(success(product));
    } catch (err) {
      next(err);
    }
  }

  async discontinue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.deleteProduct.parseParams<{ id: string }>(req.params);
      const product = await productsRepository.updateStatus(id, 'discontinued');
      if (!product) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }
      logAuditFromReq(req, 'discontinue', 'product', id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.bulkDeleteProducts.parseBody<BulkDeleteBody>(req.body);

      const deleted = await productsService.bulkDeleteProducts(parsed.ids);
      res.json(success({ deleted }));
    } catch (err) {
      next(err);
    }
  }

  async import(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { products } = contracts.importProducts.parseBody<{ products: unknown[] }>(req.body);

      const result = await productsService.importProducts(products);
      res.json(success(result));
    } catch (err) {
      next(err);
    }
  }

  async adjustStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.adjustProductStock.parseParams<{ id: string }>(req.params);
      const authReq = req as AuthRequest;
      const productId = Number(id);

      const parsed = contracts.adjustProductStock.parseBody<AdjustStockBody>(req.body);

      const result = await productsService.adjustStock(productId, parsed, authReq.user!.id);
      res.json(success(result));
    } catch (err: any) {
      next(
        err instanceof PublicError || err instanceof z.ZodError
          ? err
          : new PublicError('VALIDATION_ERROR', err.message)
      );
    }
  }

  async getStockHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.getStockHistory.parseParams<{ id: string }>(req.params);
      const rows = await productsRepository.getStockAdjustments(id);
      res.json(success(rows));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Replaces a product's image.
   *
   * Ordering is the whole design. The product is validated *before* anything is written,
   * so a rejected upload leaves no object at all; the new object is written before the row
   * so the row never points at something absent; and the previous object is deleted only
   * after the row stops referencing it. Each step's failure mode is a temporary orphan the
   * sweep collects, never a broken image or a lost upload.
   */
  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.uploadProductImage.parseParams<{ id: string }>(req.params);
      if (!req.file) {
        throw new PublicError('VALIDATION_ERROR', 'No image file provided');
      }

      const productId = Number(id);
      const storage = getStorage();

      const existing = await productsRepository.findById(productId);
      if (!existing) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }
      if (existing.status === 'discontinued') {
        throw new PublicError('FORBIDDEN', 'Cannot modify a discontinued product');
      }

      const key = productImageKey(req.file.mimetype);
      await storage.put(key, req.file.buffer, { contentType: req.file.mimetype });
      const imageUrl = storage.publicUrl(key);

      try {
        await productsRepository.updateImage(productId, imageUrl);
      } catch (err) {
        // Nothing references the object yet, so it is an orphan the moment the write
        // fails. Undo it here rather than leave it for the sweep.
        await storage.delete(key).catch((cleanupErr: Error) =>
          logger.error('Could not remove image after a failed product update', {
            key,
            error: cleanupErr.message,
          })
        );
        throw err;
      }

      const previousKey = existing.image_url ? storage.keyFromUrl(existing.image_url) : null;
      if (previousKey && previousKey !== key) {
        await storage.delete(previousKey).catch((err: Error) =>
          logger.warn('Replaced product image could not be removed; left for the sweep', {
            key: previousKey,
            error: err.message,
          })
        );
      }

      res.json(success({ image_url: imageUrl }));
    } catch (err) {
      next(err);
    }
  }

  async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.deleteProductImage.parseParams<{ id: string }>(req.params);
      const productId = Number(id);
      const storage = getStorage();

      const existing = await productsRepository.findById(productId);
      if (!existing) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }
      if (existing.status === 'discontinued') {
        throw new PublicError('FORBIDDEN', 'Cannot modify a discontinued product');
      }

      // The row is dropped first: an object that outlives its reference is collectable,
      // while a reference that outlives its object is a broken image on the shop floor.
      await productsRepository.updateImage(productId, null);

      const key = existing.image_url ? storage.keyFromUrl(existing.image_url) : null;
      if (key) {
        await storage.delete(key).catch((err: Error) =>
          logger.warn('Deleted product image could not be removed; left for the sweep', {
            key,
            error: err.message,
          })
        );
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getVariants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.listVariants.parseParams<{ id: string }>(req.params);
      const rows = await productsRepository.findVariantsByProductId(id);
      const variants = rows.map((v: any) => ({
        ...v,
        attributes:
          typeof v.attributes === 'string' ? JSON.parse(v.attributes || '{}') : v.attributes,
      }));
      res.json(success(variants));
    } catch (err) {
      next(err);
    }
  }

  async createVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.createVariant.parseParams<{ id: string }>(req.params);
      const parsed = contracts.createVariant.parseBody<Variant>(req.body);

      const productId = Number(id);
      const variant = await productsService.createVariant(productId, parsed);
      res.status(201).json(success(variant));
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'SKU or barcode already exists'));
        return;
      }
      next(err);
    }
  }

  async updateVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, variantId } = contracts.updateVariant.parseParams<{
        id: string;
        variantId: string;
      }>(req.params);
      const parsed = contracts.updateVariant.parseBody<Variant>(req.body);

      const variant = await productsService.updateVariant(id, variantId, parsed);
      if (!variant) {
        throw new PublicError('NOT_FOUND', 'Variant not found');
      }

      res.json(success(variant));
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'SKU or barcode already exists'));
        return;
      }
      next(err);
    }
  }

  async deleteVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, variantId } = contracts.deleteVariant.parseParams<{
        id: string;
        variantId: string;
      }>(req.params);
      const deleted = await productsService.deleteVariant(id, variantId);
      if (!deleted) {
        throw new PublicError('NOT_FOUND', 'Variant not found');
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getPriceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.getPriceHistory.parseParams<{ id: string }>(req.params);
      const rows = await productsRepository.getPriceHistory(id);
      res.json(success(rows));
    } catch (err) {
      next(err);
    }
  }

  async batchGenerateBarcodes(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.batchGenerateBarcodes.parseBody<BatchBarcodeBody>(req.body);

      const results = await productsService.batchGenerateBarcodes(parsed.product_ids);
      logAuditFromReq(req, 'batch_barcode', 'product', undefined, { count: results.length });
      res.json(success(results));
    } catch (err) {
      _next(err);
    }
  }
}

export const productsController = new ProductsController();
