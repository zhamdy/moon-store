import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import { productSchema } from '../validators/productSchema';

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
      `SELECT p.*, c.name as category_name, c.code as category_code, d.name as distributor_name
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
      const result = await db.query('SELECT * FROM products WHERE barcode = ?', [
        req.params.barcode,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      res.json({ success: true, data: result.rows[0] });
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

      const { name, sku, barcode, price, stock, category, category_id, distributor_id, min_stock } =
        parsed.data;

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
        `INSERT INTO products (name, sku, barcode, price, stock, category, category_id, distributor_id, min_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        [
          name,
          sku,
          barcode || null,
          price,
          stock,
          categoryText,
          category_id || null,
          distributor_id || null,
          min_stock,
        ]
      );

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

      const { name, sku, barcode, price, stock, category, category_id, distributor_id, min_stock } =
        parsed.data;

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
        `UPDATE products SET name=?, sku=?, barcode=?, price=?, stock=?, category=?, category_id=?, distributor_id=?, min_stock=?, updated_at=datetime('now')
         WHERE id=? RETURNING *`,
        [
          name,
          sku,
          barcode || null,
          price,
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
      res.json({ success: true, data: { message: 'Product deleted' } });
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
            stock,
            category,
            category_id,
            distributor_id,
            min_stock,
          } = parsed.data;
          await db.query(
            `INSERT INTO products (name, sku, barcode, price, stock, category, category_id, distributor_id, min_stock)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(sku) DO UPDATE SET name=?, price=?, stock=?, category=?, category_id=?, distributor_id=?, min_stock=?, updated_at=datetime('now')`,
            [
              name,
              sku,
              barcode || null,
              price,
              stock,
              category || null,
              category_id || null,
              distributor_id || null,
              min_stock,
              name,
              price,
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

export default router;
