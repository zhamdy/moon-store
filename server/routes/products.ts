import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { productSchema, variantSchema } from '../validators/productSchema';
import { logAuditFromReq } from '../middleware/auditLogger';
import { notifyLowStock } from '../services/notifications';

// Multer config for product image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'products');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

const router: Router = Router();

// GET /api/products
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      search,
      category,
      category_id,
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

    if (search) {
      where.push(`(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`);
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (category_id) {
      where.push(`p.category_id = ?`);
      params.push(category_id);
    } else if (category) {
      where.push(`p.category = ?`);
      params.push(category);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM products p ${whereClause}`,
      params
    );
    const total = countResult.rows[0].count;

    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.code as category_code, d.name as distributor_name,
              (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id) as variant_count,
              (SELECT COALESCE(SUM(pv.stock), 0) FROM product_variants pv WHERE pv.product_id = p.id) as variant_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN distributors d ON p.distributor_id = d.id
       ${whereClause}
       ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
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
router.get('/categories', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('SELECT id, name, code FROM categories ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/generate-sku/:categoryId — auto-generate next SKU
router.get(
  '/generate-sku/:categoryId',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const catResult = await db.query<{ code: string }>(
        'SELECT code FROM categories WHERE id = ?',
        [req.params.categoryId]
      );
      if (catResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }

      const code = catResult.rows[0].code;
      const prefix = `MN-${code}-`;

      // Find the max SKU number for this prefix
      const maxResult = await db.query<{ max_num: number | null }>(
        `SELECT MAX(CAST(SUBSTR(sku, ?) AS INTEGER)) as max_num
         FROM products WHERE sku LIKE ?`,
        [prefix.length + 1, `${prefix}%`]
      );

      const nextNum = (maxResult.rows[0].max_num || 0) + 1;
      const sku = `${prefix}${String(nextNum).padStart(3, '0')}`;

      res.json({ success: true, data: { sku } });
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prefix = '890100';

      // Find the max barcode number with this prefix
      const maxResult = await db.query<{ max_bc: string | null }>(
        `SELECT MAX(barcode) as max_bc FROM products WHERE barcode LIKE ? AND LENGTH(barcode) = 13`,
        [`${prefix}%`]
      );

      let nextSeq: number;
      if (maxResult.rows[0].max_bc) {
        // Extract the sequential part (digits after prefix, before check digit)
        const existing = maxResult.rows[0].max_bc;
        const seqPart = existing.substring(prefix.length, 12); // 6 digits
        nextSeq = parseInt(seqPart, 10) + 1;
      } else {
        nextSeq = 1;
      }

      const seqStr = String(nextSeq).padStart(6, '0');
      const partial = prefix + seqStr; // 12 digits

      // Calculate EAN-13 check digit
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(partial[i], 10) * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      const barcode = partial + checkDigit;

      res.json({ success: true, data: { barcode } });
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT p.*, c.name as category_name, c.code as category_code, d.name as distributor_name,
                (p.min_stock - p.stock) as deficit
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN distributors d ON p.distributor_id = d.id
         WHERE p.stock <= p.min_stock
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
      // First check products table
      const result = await db.query('SELECT * FROM products WHERE barcode = ?', [
        req.params.barcode,
      ]);
      if (result.rows.length > 0) {
        return res.json({ success: true, data: result.rows[0] });
      }

      // Then check variants table
      const variantResult = await db.query(
        `SELECT v.*, p.name as product_name, p.category, p.category_id, p.image_url, p.has_variants
         FROM product_variants v
         JOIN products p ON v.product_id = p.id
         WHERE v.barcode = ?`,
        [req.params.barcode]
      );
      if (variantResult.rows.length > 0) {
        const v = variantResult.rows[0] as Record<string, any>;
        // Return as a product-like object for POS compatibility
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
            variant_attributes: JSON.parse(v.attributes || '{}'),
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
       WHERE p.id = ?`,
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

      const {
        name,
        sku,
        barcode,
        price,
        cost_price,
        stock,
        category,
        category_id,
        distributor_id,
        min_stock,
      } = parsed.data;

      // Resolve category text from category_id if not provided
      let categoryText = category || null;
      if (category_id && !categoryText) {
        const catResult = await db.query<{ name: string }>(
          'SELECT name FROM categories WHERE id = ?',
          [category_id]
        );
        if (catResult.rows.length > 0) {
          categoryText = catResult.rows[0].name;
        }
      }

      const result = await db.query(
        `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, distributor_id, min_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        [
          name,
          sku,
          barcode || null,
          price,
          cost_price,
          stock,
          categoryText,
          category_id || null,
          distributor_id || null,
          min_stock,
        ]
      );

      logAuditFromReq(req, 'create', 'product', result.rows[0]?.id, { name, sku, price });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
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

      const {
        name,
        sku,
        barcode,
        price,
        cost_price,
        stock,
        category,
        category_id,
        distributor_id,
        min_stock,
      } = parsed.data;

      // Resolve category text from category_id if not provided
      let categoryText = category || null;
      if (category_id && !categoryText) {
        const catResult = await db.query<{ name: string }>(
          'SELECT name FROM categories WHERE id = ?',
          [category_id]
        );
        if (catResult.rows.length > 0) {
          categoryText = catResult.rows[0].name;
        }
      }

      const result = await db.query(
        `UPDATE products SET name=?, sku=?, barcode=?, price=?, cost_price=?, stock=?, category=?, category_id=?, distributor_id=?, min_stock=?, updated_at=datetime('now')
         WHERE id=? RETURNING *`,
        [
          name,
          sku,
          barcode || null,
          price,
          cost_price,
          stock,
          categoryText,
          category_id || null,
          distributor_id || null,
          min_stock,
          req.params.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      logAuditFromReq(req, 'update', 'product', req.params.id);

      // Check low stock
      const updated = result.rows[0] as Record<string, any>;
      if (updated.stock <= updated.min_stock) {
        notifyLowStock(updated.name, updated.stock, updated.id);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
      }
      next(err);
    }
  }
);

// DELETE /api/products/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query('DELETE FROM products WHERE id = ? RETURNING id', [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      logAuditFromReq(req, 'delete', 'product', req.params.id);
      res.json({ success: true, data: { message: 'Product deleted' } });
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

      const { ids } = parsed.data;
      const placeholders = ids.map(() => '?').join(',');
      const result = await db.query(
        `DELETE FROM products WHERE id IN (${placeholders}) RETURNING id`,
        ids
      );

      res.json({ success: true, data: { deleted: result.rows.length } });
    } catch (err) {
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
      const rawDb = db.db;

      const txn = rawDb.transaction(() => {
        let updated = 0;

        if (updates.category_id !== undefined) {
          // Resolve category name
          const cat = rawDb
            .prepare('SELECT name FROM categories WHERE id = ?')
            .get(updates.category_id) as { name: string } | undefined;
          if (!cat) throw new Error('Category not found');

          const placeholders = ids.map(() => '?').join(',');
          const stmt = rawDb.prepare(
            `UPDATE products SET category_id = ?, category = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
          );
          const result = stmt.run(updates.category_id, cat.name, ...ids);
          updated = result.changes;
        }

        if (updates.distributor_id !== undefined) {
          const placeholders = ids.map(() => '?').join(',');
          const stmt = rawDb.prepare(
            `UPDATE products SET distributor_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
          );
          const result = stmt.run(updates.distributor_id, ...ids);
          updated = result.changes;
        }

        if (updates.price_percent !== undefined) {
          const factor = 1 + updates.price_percent / 100;
          const placeholders = ids.map(() => '?').join(',');
          const stmt = rawDb.prepare(
            `UPDATE products SET price = ROUND(price * ?, 2), updated_at = datetime('now') WHERE id IN (${placeholders})`
          );
          const result = stmt.run(factor, ...ids);
          updated = result.changes;
        }

        return updated;
      });

      const updated = txn();
      res.json({ success: true, data: { updated } });
    } catch (err: any) {
      if (err.message === 'Category not found') {
        return res.status(404).json({ success: false, error: err.message });
      }
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

      let imported = 0;
      const errors: { row: number; error: string }[] = [];
      for (let i = 0; i < products.length; i++) {
        const parsed = productSchema.safeParse(products[i]);
        if (!parsed.success) {
          errors.push({ row: i + 1, error: parsed.error.errors[0].message });
          continue;
        }
        try {
          const {
            name,
            sku,
            barcode,
            price,
            cost_price,
            stock,
            category,
            category_id,
            distributor_id,
            min_stock,
          } = parsed.data;
          await db.query(
            `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, distributor_id, min_stock)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(sku) DO UPDATE SET name=?, price=?, cost_price=?, stock=?, category=?, category_id=?, distributor_id=?, min_stock=?, updated_at=datetime('now')`,
            [
              name,
              sku,
              barcode || null,
              price,
              cost_price,
              stock,
              category || null,
              category_id || null,
              distributor_id || null,
              min_stock,
              name,
              price,
              cost_price,
              stock,
              category || null,
              category_id || null,
              distributor_id || null,
              min_stock,
            ]
          );
          imported++;
        } catch (err: any) {
          errors.push({ row: i + 1, error: err.message });
        }
      }

      res.json({ success: true, data: { imported, errors } });
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

      const { delta, reason } = parsed.data;

      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        const product = rawDb
          .prepare('SELECT id, stock FROM products WHERE id = ?')
          .get(productId) as { id: number; stock: number } | undefined;

        if (!product) {
          throw new Error('Product not found');
        }

        const previousQty = product.stock;
        const newQty = previousQty + delta;

        if (newQty < 0) {
          throw new Error('Stock cannot go below zero');
        }

        rawDb
          .prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?")
          .run(newQty, productId);

        rawDb
          .prepare(
            'INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(productId, previousQty, newQty, delta, reason, authReq.user!.id);

        return { previous_qty: previousQty, new_qty: newQty, delta };
      });

      let result;
      try {
        result = txn();
      } catch (err: any) {
        return res.status(400).json({ success: false, error: err.message });
      }

      // Check low stock after adjustment
      const prod = rawDb
        .prepare('SELECT name, stock, min_stock FROM products WHERE id = ?')
        .get(productId) as { name: string; stock: number; min_stock: number } | undefined;
      if (prod && prod.stock <= prod.min_stock) {
        notifyLowStock(prod.name, prod.stock, productId);
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
         WHERE sa.product_id = ?
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
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' });
      }

      const productId = Number(req.params.id);
      const imageUrl = `/uploads/products/${req.file.filename}`;

      // Delete old image if exists
      const existing = await db.query<{ image_url: string | null }>(
        'SELECT image_url FROM products WHERE id = ?',
        [productId]
      );
      if (existing.rows.length === 0) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      if (existing.rows[0].image_url) {
        const oldPath = path.join(__dirname, '..', existing.rows[0].image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      await db.query(
        "UPDATE products SET image_url = ?, updated_at = datetime('now') WHERE id = ?",
        [imageUrl, productId]
      );

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

      const existing = await db.query<{ image_url: string | null }>(
        'SELECT image_url FROM products WHERE id = ?',
        [productId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      if (existing.rows[0].image_url) {
        const oldPath = path.join(__dirname, '..', existing.rows[0].image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      await db.query(
        "UPDATE products SET image_url = NULL, updated_at = datetime('now') WHERE id = ?",
        [productId]
      );

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
        `SELECT * FROM product_variants WHERE product_id = ? ORDER BY sku`,
        [req.params.id]
      );
      // Parse attributes JSON
      const variants = result.rows.map((v: any) => ({
        ...v,
        attributes: JSON.parse(v.attributes || '{}'),
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
      const { sku, barcode, price, cost_price, stock, attributes } = parsed.data;

      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        // Verify product exists
        const product = rawDb.prepare('SELECT id FROM products WHERE id = ?').get(productId) as
          | Record<string, any>
          | undefined;
        if (!product) throw new Error('Product not found');

        // Mark product as has_variants
        rawDb.prepare('UPDATE products SET has_variants = 1 WHERE id = ?').run(productId);

        const variant = rawDb
          .prepare(
            `INSERT INTO product_variants (product_id, sku, barcode, price, cost_price, stock, attributes)
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
          )
          .get(
            productId,
            sku,
            barcode || null,
            price || null,
            cost_price,
            stock,
            JSON.stringify(attributes)
          ) as Record<string, any>;

        return variant;
      });

      try {
        const variant = txn();
        res.status(201).json({
          success: true,
          data: { ...variant, attributes: JSON.parse(variant.attributes || '{}') },
        });
      } catch (err: any) {
        if (err.message === 'Product not found') {
          return res.status(404).json({ success: false, error: err.message });
        }
        if (err.message?.includes('UNIQUE')) {
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

      const { sku, barcode, price, cost_price, stock, attributes } = parsed.data;

      const result = await db.query(
        `UPDATE product_variants SET sku=?, barcode=?, price=?, cost_price=?, stock=?, attributes=?
         WHERE id=? AND product_id=? RETURNING *`,
        [
          sku,
          barcode || null,
          price || null,
          cost_price,
          stock,
          JSON.stringify(attributes),
          req.params.variantId,
          req.params.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Variant not found' });
      }

      const variant = result.rows[0] as Record<string, any>;
      res.json({
        success: true,
        data: { ...variant, attributes: JSON.parse(variant.attributes || '{}') },
      });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
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
      const result = await db.query(
        'DELETE FROM product_variants WHERE id = ? AND product_id = ? RETURNING id',
        [req.params.variantId, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Variant not found' });
      }

      // Check if any variants remain — if not, unset has_variants
      const remaining = await db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM product_variants WHERE product_id = ?',
        [req.params.id]
      );
      if (remaining.rows[0].count === 0) {
        await db.query('UPDATE products SET has_variants = 0 WHERE id = ?', [req.params.id]);
      }

      res.json({ success: true, data: { message: 'Variant deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
