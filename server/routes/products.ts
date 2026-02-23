import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import { productSchema } from '../validators/productSchema';

const router: Router = Router();

// GET /api/products
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, category, page = 1, limit = 25, sort = 'name', order = 'asc' } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const allowedSorts = ['name', 'price', 'stock', 'category', 'created_at'];
    const sortCol = allowedSorts.includes(sort as string) ? sort : 'name';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

    const where: string[] = [];
    const params: unknown[] = [];

    if (search) {
      where.push(`(name LIKE ? OR sku LIKE ? OR barcode LIKE ?)`);
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (category) {
      where.push(`category = ?`);
      params.push(category);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM products ${whereClause}`,
      params
    );
    const total = countResult.rows[0].count;

    const result = await db.query(
      `SELECT * FROM products ${whereClause} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`,
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

// GET /api/products/categories
router.get('/categories', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query<{ category: string }>('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category');
    res.json({ success: true, data: result.rows.map(r => r.category) });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('SELECT * FROM products WHERE barcode = ?', [req.params.barcode]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/products
router.post('/', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { name, sku, barcode, price, stock, category, min_stock } = parsed.data;
    const result = await db.query(
      `INSERT INTO products (name, sku, barcode, price, stock, category, min_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [name, sku, barcode || null, price, stock, category || null, min_stock]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'SKU or barcode already exists' });
    }
    next(err);
  }
});

// PUT /api/products/:id
router.put('/:id', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { name, sku, barcode, price, stock, category, min_stock } = parsed.data;
    const result = await db.query(
      `UPDATE products SET name=?, sku=?, barcode=?, price=?, stock=?, category=?, min_stock=?, updated_at=datetime('now')
       WHERE id=? RETURNING *`,
      [name, sku, barcode || null, price, stock, category || null, min_stock, req.params.id]
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
});

// DELETE /api/products/:id
router.delete('/:id', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('DELETE FROM products WHERE id = ? RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: { message: 'Product deleted' } });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/import
router.post('/import', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
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
        const { name, sku, barcode, price, stock, category, min_stock } = parsed.data;
        await db.query(
          `INSERT INTO products (name, sku, barcode, price, stock, category, min_stock)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(sku) DO UPDATE SET name=?, price=?, stock=?, category=?, min_stock=?, updated_at=datetime('now')`,
          [name, sku, barcode || null, price, stock, category || null, min_stock, name, price, stock, category || null, min_stock]
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
});

export default router;
