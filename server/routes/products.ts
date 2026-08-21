import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import db from '../src/database/pool';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { productSchema, productStatusSchema, variantSchema } from '../validators/productSchema';
import { logAuditFromReq } from '../middleware/auditLogger';
import { createUpload, validateMagic, uploadRateLimit } from '../middleware/upload';
import { cacheControl } from '../middleware/cache';
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
} from '../services/productService';

const upload = createUpload({ maxSize: 2 * 1024 * 1024, destination: 'uploads/products' });

const router: Router = Router();

// GET /api/products
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
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
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const allowedSorts = ['name', 'price', 'stock', 'category', 'created_at'];
    const sortCol = allowedSorts.includes(sort as string) ? `p.${sort}` : 'p.name';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      where.push(
        `(p.name ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx} OR p.barcode ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (collection_id) {
      where.push(
        `p.id IN (SELECT product_id FROM collection_products WHERE collection_id = $${paramIdx++})`
      );
      params.push(collection_id);
    } else if (category_id) {
      where.push(`p.category_id = $${paramIdx++}`);
      params.push(category_id);
    } else if (category) {
      where.push(`p.category = $${paramIdx++}`);
      params.push(category);
    }

    if (status && status !== 'all') {
      where.push(`p.status = $${paramIdx++}`);
      params.push(status);
    } else if (!status) {
      where.push(`p.status = 'active'`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM products p ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.count || 0);

    const queryParams = [...params, limitNum, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.code as category_code, d.name as distributor_name,
              (SELECT COUNT(*)::int FROM product_variants pv WHERE pv.product_id = p.id) as variant_count,
              (SELECT COALESCE(SUM(pv.stock), 0)::int FROM product_variants pv WHERE pv.product_id = p.id) as variant_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN distributors d ON p.distributor_id = d.id
       ${whereClause}
       ORDER BY ${sortCol} ${sortOrder} LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { total, page: pageNum, limit: limitNum },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/categories — return full category objects
router.get(
  '/categories',
  verifyToken,
  cacheControl(300),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query('SELECT id, name, code FROM categories ORDER BY name');
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/products/generate-sku/:categoryId — auto-generate next SKU
router.get(
  '/generate-sku/:categoryId',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await generateSku(Number(req.params.categoryId));
      if (!result) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/products/generate-barcode — auto-generate next EAN-13
router.get(
  '/generate-barcode',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await generateBarcode();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/products/low-stock
router.get(
  '/low-stock',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT p.*, c.name as category_name, c.code as category_code, d.name as distributor_name,
                (p.min_stock - p.stock) as deficit
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN distributors d ON p.distributor_id = d.id
         WHERE p.stock <= p.min_stock AND p.status = 'active'
         ORDER BY deficit DESC, p.stock ASC`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/products/barcode/:barcode
router.get(
  '/barcode/:barcode',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        "SELECT * FROM products WHERE barcode = $1 AND status = 'active'",
        [req.params.barcode]
      );
      if (result.rows.length > 0) {
        return res.json({ success: true, data: result.rows[0] });
      }

      const variantResult = await db.query(
        `SELECT v.*, p.name as product_name, p.category, p.category_id, p.image_url, p.has_variants
         FROM product_variants v
         JOIN products p ON v.product_id = p.id
         WHERE v.barcode = $1 AND p.status = 'active'`,
        [req.params.barcode]
      );
      if (variantResult.rows.length > 0) {
        const v = variantResult.rows[0] as Record<string, any>;
        return res.json({
          success: true,
          data: {
            id: v.product_id,
            name: v.product_name,
            sku: v.sku,
            barcode: v.barcode,
            price: v.price,
            stock: v.stock,
            category: v.category,
            category_id: v.category_id,
            image_url: v.image_url,
            variant_id: v.id,
            variant_attributes:
              typeof v.attributes === 'string' ? JSON.parse(v.attributes || '{}') : v.attributes,
          },
        });
      }

      return res.status(404).json({ success: false, error: 'Product not found' });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/products/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.code as category_code, d.name as distributor_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN distributors d ON p.distributor_id = d.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/products
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const product = await createProduct(parsed.data);
      logAuditFromReq(req, 'create', 'product', product?.id, {
        name: parsed.data.name,
        sku: parsed.data.sku,
        price: parsed.data.price,
      });
      res.status(201).json({ success: true, data: product });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        return res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
      }
      next(err);
    }
  }
);

// PUT /api/products/bulk-update
const bulkUpdateSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  updates: z.object({
    category_id: z.number().int().positive().optional(),
    distributor_id: z.number().int().positive().nullable().optional(),
    price_percent: z.number().min(-99).max(1000).optional(),
    status: z.enum(['active', 'inactive', 'discontinued']).optional(),
  }),
});

router.put(
  '/bulk-update',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { ids, updates } = parsed.data;
      const updated = await bulkUpdateProducts(ids, updates);
      res.json({ success: true, data: { updated } });
    } catch (err: any) {
      if (err.message === 'Category not found') {
        return res.status(404).json({ success: false, error: err.message });
      }
      next(err);
    }
  }
);

// PUT /api/products/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const authReq = req as AuthRequest;
      const product = await updateProduct(req.params.id as string, parsed.data, authReq.user!.id);

      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      logAuditFromReq(req, 'update', 'product', req.params.id as string);
      res.json({ success: true, data: product });
    } catch (err: any) {
      if (err.type === 'discontinued') {
        return res.status(403).json({ success: false, error: err.message });
      }
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        return res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
      }
      next(err);
    }
  }
);

// PUT /api/products/:id/status
router.put(
  '/:id/status',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = productStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { status } = parsed.data;
      const result = await db.query(
        `UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      logAuditFromReq(req, 'status_change', 'product', req.params.id as string, { status });
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/products/:id (soft delete -> discontinue)
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `UPDATE products SET status = 'discontinued', updated_at = NOW() WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      logAuditFromReq(req, 'discontinue', 'product', req.params.id as string);
      res.json({ success: true, data: { message: 'Product discontinued' } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/products/bulk-delete
const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one product ID required'),
});

router.post(
  '/bulk-delete',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = bulkDeleteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const deleted = await bulkDeleteProducts(parsed.data.ids);
      res.json({ success: true, data: { deleted } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/products/import
router.post(
  '/import',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ success: false, error: 'Products array required' });
      }

      const result = await importProducts(products);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/products/:id/adjust-stock
const adjustStockSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Delta cannot be zero'),
  reason: z.enum(['Manual Adjustment', 'Damaged', 'Stock Count']),
});

router.post(
  '/:id/adjust-stock',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const productId = Number(req.params.id);

      const parsed = adjustStockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      let result;
      try {
        result = await adjustStock(productId, parsed.data, authReq.user!.id);
      } catch (err: any) {
        return res.status(400).json({ success: false, error: err.message });
      }

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/products/:id/stock-history
router.get(
  '/:id/stock-history',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT sa.*, u.name as user_name
         FROM stock_adjustments sa
         LEFT JOIN users u ON sa.user_id = u.id
         WHERE sa.product_id = $1
         ORDER BY sa.created_at DESC
         LIMIT 50`,
        [req.params.id]
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/products/:id/image
router.post(
  '/:id/image',
  verifyToken,
  requireRole('Admin'),
  uploadRateLimit,
  upload.single('image'),
  validateMagic,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' });
      }

      const productId = Number(req.params.id);
      const imageUrl = `/uploads/products/${req.file.filename}`;

      const existing = await db.query<{ image_url: string | null; status: string }>(
        'SELECT image_url, status FROM products WHERE id = $1',
        [productId]
      );
      if (existing.rows.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      if (existing.rows[0].status === 'discontinued') {
        fs.unlinkSync(req.file.path);
        return res
          .status(403)
          .json({ success: false, error: 'Cannot modify a discontinued product' });
      }
      if (existing.rows[0].image_url) {
        const oldPath = path.join(__dirname, '..', existing.rows[0].image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      await db.query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [
        imageUrl,
        productId,
      ]);

      res.json({ success: true, data: { image_url: imageUrl } });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/products/:id/image
router.delete(
  '/:id/image',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = Number(req.params.id);

      const existing = await db.query<{ image_url: string | null; status: string }>(
        'SELECT image_url, status FROM products WHERE id = $1',
        [productId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      if (existing.rows[0].status === 'discontinued') {
        return res
          .status(403)
          .json({ success: false, error: 'Cannot modify a discontinued product' });
      }
      if (existing.rows[0].image_url) {
        const oldPath = path.join(__dirname, '..', existing.rows[0].image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      await db.query('UPDATE products SET image_url = NULL, updated_at = NOW() WHERE id = $1', [
        productId,
      ]);

      res.json({ success: true, data: { message: 'Image removed' } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/products/:id/variants
router.get(
  '/:id/variants',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sku`,
        [req.params.id]
      );
      const variants = result.rows.map((v: any) => ({
        ...v,
        attributes:
          typeof v.attributes === 'string' ? JSON.parse(v.attributes || '{}') : v.attributes,
      }));
      res.json({ success: true, data: variants });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/products/:id/variants
router.post(
  '/:id/variants',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = variantSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const productId = Number(req.params.id);

      try {
        const variant = await createVariant(productId, parsed.data);
        res.status(201).json({ success: true, data: variant });
      } catch (err: any) {
        if (err.message === 'Product not found') {
          return res.status(404).json({ success: false, error: err.message });
        }
        if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
          return res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/products/:id/variants/:variantId
router.put(
  '/:id/variants/:variantId',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = variantSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const variant = await updateVariant(
        req.params.id as string,
        req.params.variantId as string,
        parsed.data
      );
      if (!variant) {
        return res.status(404).json({ success: false, error: 'Variant not found' });
      }

      res.json({ success: true, data: variant });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate key')) {
        return res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
      }
      next(err);
    }
  }
);

// DELETE /api/products/:id/variants/:variantId
router.delete(
  '/:id/variants/:variantId',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await deleteVariant(req.params.id as string, req.params.variantId as string);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Variant not found' });
      }

      res.json({ success: true, data: { message: 'Variant deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/products/:id/price-history
router.get(
  '/:id/price-history',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT ph.*, u.name as user_name
         FROM price_history ph
         LEFT JOIN users u ON ph.user_id = u.id
         WHERE ph.product_id = $1
         ORDER BY ph.created_at DESC
         LIMIT 50`,
        [req.params.id]
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/products/batch-generate-barcodes
const batchBarcodeSchema = z.object({
  product_ids: z.array(z.number().int().positive()).min(1),
});

router.post(
  '/batch-generate-barcodes',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = batchBarcodeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const results = await batchGenerateBarcodes(parsed.data.product_ids);
      logAuditFromReq(req, 'batch_barcode', 'product', undefined, { count: results.length });
      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
