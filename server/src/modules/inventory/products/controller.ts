import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import {
  productSchema,
  productStatusSchema,
  variantSchema,
} from '../../../../validators/productSchema';
import { productsService } from './service';
import { productsRepository } from './repository';
import { z } from 'zod';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';
import { parseProductListQuery, parseProductLookupQuery } from './types';

const bulkUpdateSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  updates: z.object({
    category_id: z.number().int().positive().optional(),
    distributor_id: z.number().int().positive().nullable().optional(),
    price_percent: z.number().min(-99).max(1000).optional(),
    status: z.enum(['active', 'inactive', 'discontinued']).optional(),
  }),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one product ID required'),
});

const adjustStockSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Delta cannot be zero'),
  reason: z.enum(['Manual Adjustment', 'Damaged', 'Stock Count']),
});

const batchBarcodeSchema = z.object({
  product_ids: z.array(z.number().int().positive()).min(1),
});

export class ProductsController {
  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseProductListQuery(req.query);
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
      const { ids } = parseProductLookupQuery(req.query);
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
      const result = await productsService.generateSku(Number(req.params.categoryId));
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
      const barcode = req.params.barcode as string;
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
      const product = await productsRepository.findById(req.params.id as string);
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
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const product = await productsService.createProduct(parsed.data);
      logAuditFromReq(req, 'create', 'product', product?.id, {
        name: parsed.data.name,
        sku: parsed.data.sku,
        price: parsed.data.price,
      });
      res.status(201).json(success(product));
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        next(new PublicError('CONFLICT', 'SKU or barcode already exists'));
        return;
      }
      next(err);
    }
  }

  async bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const { ids, updates } = parsed.data;
      const updated = await productsService.bulkUpdateProducts(ids, updates);
      res.json(success({ updated }));
    } catch (err: any) {
      if (err.message === 'Category not found') {
        next(new PublicError('NOT_FOUND', err.message));
        return;
      }
      next(err);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const authReq = req as AuthRequest;
      const product = await productsService.updateProduct(
        req.params.id as string,
        parsed.data,
        authReq.user!.id
      );

      if (!product) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }

      logAuditFromReq(req, 'update', 'product', req.params.id as string);
      res.json(success(product));
    } catch (err: any) {
      if (err.type === 'discontinued') {
        next(new PublicError('FORBIDDEN', err.message));
        return;
      }
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        next(new PublicError('CONFLICT', 'SKU or barcode already exists'));
        return;
      }
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = productStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const { status } = parsed.data;
      const product = await productsRepository.updateStatus(req.params.id as string, status);

      if (!product) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }

      logAuditFromReq(req, 'status_change', 'product', req.params.id as string, { status });
      res.json(success(product));
    } catch (err) {
      next(err);
    }
  }

  async discontinue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productsRepository.updateStatus(
        req.params.id as string,
        'discontinued'
      );
      if (!product) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }
      logAuditFromReq(req, 'discontinue', 'product', req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = bulkDeleteSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const deleted = await productsService.bulkDeleteProducts(parsed.data.ids);
      res.json(success({ deleted }));
    } catch (err) {
      next(err);
    }
  }

  async import(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        throw new PublicError('VALIDATION_ERROR', 'Products array required');
      }

      const result = await productsService.importProducts(products);
      res.json(success(result));
    } catch (err) {
      next(err);
    }
  }

  async adjustStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const productId = Number(req.params.id);

      const parsed = adjustStockSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const result = await productsService.adjustStock(productId, parsed.data, authReq.user!.id);
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
      const rows = await productsRepository.getStockAdjustments(req.params.id as string);
      res.json(success(rows));
    } catch (err) {
      next(err);
    }
  }

  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new PublicError('VALIDATION_ERROR', 'No image file provided');
      }

      const productId = Number(req.params.id);
      const imageUrl = `/uploads/products/${req.file.filename}`;

      const existing = await productsRepository.findById(productId);
      if (!existing) {
        fs.unlinkSync(req.file.path);
        throw new PublicError('NOT_FOUND', 'Product not found');
      }
      if (existing.status === 'discontinued') {
        fs.unlinkSync(req.file.path);
        throw new PublicError('FORBIDDEN', 'Cannot modify a discontinued product');
      }
      if (existing.image_url) {
        const oldPath = path.join(__dirname, '../../../../..', existing.image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      await productsRepository.updateImage(productId, imageUrl);
      res.json(success({ image_url: imageUrl }));
    } catch (err) {
      next(err);
    }
  }

  async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = Number(req.params.id);
      const existing = await productsRepository.findById(productId);
      if (!existing) {
        throw new PublicError('NOT_FOUND', 'Product not found');
      }
      if (existing.status === 'discontinued') {
        throw new PublicError('FORBIDDEN', 'Cannot modify a discontinued product');
      }
      if (existing.image_url) {
        const oldPath = path.join(__dirname, '../../../../..', existing.image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      await productsRepository.updateImage(productId, null);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getVariants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await productsRepository.findVariantsByProductId(req.params.id as string);
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
      const parsed = variantSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const productId = Number(req.params.id);
      const variant = await productsService.createVariant(productId, parsed.data);
      res.status(201).json(success(variant));
    } catch (err: any) {
      if (err.message === 'Product not found') {
        next(new PublicError('NOT_FOUND', err.message));
        return;
      }
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        next(new PublicError('CONFLICT', 'SKU or barcode already exists'));
        return;
      }
      next(err);
    }
  }

  async updateVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = variantSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const variant = await productsService.updateVariant(
        req.params.id as string,
        req.params.variantId as string,
        parsed.data
      );
      if (!variant) {
        throw new PublicError('NOT_FOUND', 'Variant not found');
      }

      res.json(success(variant));
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        next(new PublicError('CONFLICT', 'SKU or barcode already exists'));
        return;
      }
      next(err);
    }
  }

  async deleteVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await productsService.deleteVariant(
        req.params.id as string,
        req.params.variantId as string
      );
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
      const rows = await productsRepository.getPriceHistory(req.params.id as string);
      res.json(success(rows));
    } catch (err) {
      next(err);
    }
  }

  async batchGenerateBarcodes(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const parsed = batchBarcodeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const results = await productsService.batchGenerateBarcodes(parsed.data.product_ids);
      logAuditFromReq(req, 'batch_barcode', 'product', undefined, { count: results.length });
      res.json(success(results));
    } catch (err) {
      _next(err);
    }
  }
}

export const productsController = new ProductsController();
