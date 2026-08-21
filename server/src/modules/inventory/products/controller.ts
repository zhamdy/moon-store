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
      const {
        search,
        category,
        category_id,
        collection_id,
        status,
        page = 1,
        limit = 25,
        sort = 'name',
        order = 'asc',
      } = req.query;

      const result = await productsRepository.list({
        search: search as string | undefined,
        category: category as string | undefined,
        category_id: category_id ? Number(category_id) : undefined,
        collection_id: collection_id ? Number(collection_id) : undefined,
        status: status as string | undefined,
        page: Number(page),
        limit: Number(limit),
        sort: sort as string,
        order: order as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }

  async getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await productsRepository.listCategories();
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  async generateSku(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productsService.generateSku(Number(req.params.categoryId));
      if (!result) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async generateBarcode(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productsService.generateBarcode();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getLowStock(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await productsRepository.listLowStock();
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  async getByBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const barcode = req.params.barcode as string;
      const product = await productsRepository.findByBarcode(barcode);
      if (product) {
        res.json({ success: true, data: product });
        return;
      }

      const variant = await productsRepository.findVariantByBarcode(barcode);
      if (variant) {
        res.json({
          success: true,
          data: {
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
          },
        });
        return;
      }

      res.status(404).json({ success: false, error: 'Product not found' });
    } catch (err) {
      next(err);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productsRepository.findById(req.params.id as string);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      res.json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const product = await productsService.createProduct(parsed.data);
      logAuditFromReq(req, 'create', 'product', product?.id, {
        name: parsed.data.name,
        sku: parsed.data.sku,
        price: parsed.data.price,
      });
      res.status(201).json({ success: true, data: product });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
        return;
      }
      next(err);
    }
  }

  async bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const { ids, updates } = parsed.data;
      const updated = await productsService.bulkUpdateProducts(ids, updates);
      res.json({ success: true, data: { updated } });
    } catch (err: any) {
      if (err.message === 'Category not found') {
        res.status(404).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const authReq = req as AuthRequest;
      const product = await productsService.updateProduct(
        req.params.id as string,
        parsed.data,
        authReq.user!.id
      );

      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      logAuditFromReq(req, 'update', 'product', req.params.id as string);
      res.json({ success: true, data: product });
    } catch (err: any) {
      if (err.type === 'discontinued') {
        res.status(403).json({ success: false, error: err.message });
        return;
      }
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
        return;
      }
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = productStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const { status } = parsed.data;
      const product = await productsRepository.updateStatus(req.params.id as string, status);

      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      logAuditFromReq(req, 'status_change', 'product', req.params.id as string, { status });
      res.json({ success: true, data: product });
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
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      logAuditFromReq(req, 'discontinue', 'product', req.params.id as string);
      res.json({ success: true, data: { message: 'Product discontinued' } });
    } catch (err) {
      next(err);
    }
  }

  async bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = bulkDeleteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const deleted = await productsService.bulkDeleteProducts(parsed.data.ids);
      res.json({ success: true, data: { deleted } });
    } catch (err) {
      next(err);
    }
  }

  async import(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        res.status(400).json({ success: false, error: 'Products array required' });
        return;
      }

      const result = await productsService.importProducts(products);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async adjustStock(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const productId = Number(req.params.id);

      const parsed = adjustStockSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const result = await productsService.adjustStock(productId, parsed.data, authReq.user!.id);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async getStockHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await productsRepository.getStockAdjustments(req.params.id as string);
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No image file provided' });
        return;
      }

      const productId = Number(req.params.id);
      const imageUrl = `/uploads/products/${req.file.filename}`;

      const existing = await productsRepository.findById(productId);
      if (!existing) {
        fs.unlinkSync(req.file.path);
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      if (existing.status === 'discontinued') {
        fs.unlinkSync(req.file.path);
        res.status(403).json({ success: false, error: 'Cannot modify a discontinued product' });
        return;
      }
      if (existing.image_url) {
        const oldPath = path.join(__dirname, '../../../../..', existing.image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      await productsRepository.updateImage(productId, imageUrl);
      res.json({ success: true, data: { image_url: imageUrl } });
    } catch (err) {
      next(err);
    }
  }

  async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = Number(req.params.id);
      const existing = await productsRepository.findById(productId);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      if (existing.status === 'discontinued') {
        res.status(403).json({ success: false, error: 'Cannot modify a discontinued product' });
        return;
      }
      if (existing.image_url) {
        const oldPath = path.join(__dirname, '../../../../..', existing.image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      await productsRepository.updateImage(productId, null);
      res.json({ success: true, data: { message: 'Image removed' } });
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
      res.json({ success: true, data: variants });
    } catch (err) {
      next(err);
    }
  }

  async createVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = variantSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const productId = Number(req.params.id);
      const variant = await productsService.createVariant(productId, parsed.data);
      res.status(201).json({ success: true, data: variant });
    } catch (err: any) {
      if (err.message === 'Product not found') {
        res.status(404).json({ success: false, error: err.message });
        return;
      }
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
        return;
      }
      next(err);
    }
  }

  async updateVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = variantSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const variant = await productsService.updateVariant(
        req.params.id as string,
        req.params.variantId as string,
        parsed.data
      );
      if (!variant) {
        res.status(404).json({ success: false, error: 'Variant not found' });
        return;
      }

      res.json({ success: true, data: variant });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
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
        res.status(404).json({ success: false, error: 'Variant not found' });
        return;
      }

      res.json({ success: true, data: { message: 'Variant deleted' } });
    } catch (err) {
      next(err);
    }
  }

  async getPriceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await productsRepository.getPriceHistory(req.params.id as string);
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  async batchGenerateBarcodes(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const parsed = batchBarcodeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const results = await productsService.batchGenerateBarcodes(parsed.data.product_ids);
      logAuditFromReq(req, 'batch_barcode', 'product', undefined, { count: results.length });
      res.json({ success: true, data: results });
    } catch (err) {
      _next(err);
    }
  }
}

export const productsController = new ProductsController();
