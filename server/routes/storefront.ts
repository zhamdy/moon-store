import { Router, Request, Response, NextFunction } from 'express';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

// GET /api/storefront/products — public product catalog
router.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, category, sort, page = '1', limit = '20' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = "WHERE p.status = 'active' AND p.stock > 0";
    const params: unknown[] = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`;
    }
    if (category) {
      params.push(category);
      where += ` AND p.category = $${params.length}`;
    }
    let orderBy = 'ORDER BY p.created_at DESC';
    if (sort === 'price_asc') orderBy = 'ORDER BY p.price ASC';
    if (sort === 'price_desc') orderBy = 'ORDER BY p.price DESC';
    if (sort === 'name') orderBy = 'ORDER BY p.name ASC';
    if (sort === 'popular') orderBy = 'ORDER BY sold_count DESC';

    const countResult = await db.query<{ total: string | number }>(
      `SELECT COUNT(*)::int as total FROM products p ${where}`,
      params
    );
    const total = Number(countResult.rows[0].total);

    const limitNum = Number(limit);
    const offsetNum = offset;
    const queryParams = [...params, limitNum, offsetNum];

    const result = await db.query(
      `SELECT p.*, COALESCE((SELECT AVG(r.rating) FROM product_reviews r WHERE r.product_id = p.id AND r.is_approved = 1), 0) as avg_rating,
       COALESCE((SELECT COUNT(*)::int FROM product_reviews r WHERE r.product_id = p.id AND r.is_approved = 1), 0) as review_count,
       COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.product_id = p.id), 0) as sold_count
       FROM products p ${where} ${orderBy} LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );
    res.json({
      success: true,
      data: result.rows,
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/storefront/products/:id — single product with reviews
router.get('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await db.query(
      `SELECT p.*, COALESCE((SELECT AVG(r.rating) FROM product_reviews r WHERE r.product_id = p.id AND r.is_approved = 1), 0) as avg_rating
       FROM products p WHERE p.id = $1 AND p.status = 'active'`,
      [req.params.id]
    );
    if (product.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Product not found' });
    const reviews = await db.query(
      `SELECT r.*, c.name as customer_name FROM product_reviews r LEFT JOIN customers c ON r.customer_id = c.id
       WHERE r.product_id = $1 AND r.is_approved = 1 ORDER BY r.created_at DESC LIMIT 20`,
      [req.params.id]
    );
    const variants = await db.query('SELECT * FROM product_variants WHERE product_id = $1', [
      req.params.id,
    ]);
    res.json({
      success: true,
      data: { ...product.rows[0], reviews: reviews.rows, variants: variants.rows },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/storefront/categories
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      "SELECT DISTINCT category FROM products WHERE status = 'active' AND category IS NOT NULL ORDER BY category"
    );
    res.json({ success: true, data: result.rows.map((r: any) => r.category) });
  } catch (err) {
    next(err);
  }
});

// GET /api/storefront/config
router.get('/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('SELECT config_key, config_value FROM storefront_config');
    const config: Record<string, string> = {};
    result.rows.forEach((r: any) => {
      config[r.config_key] = r.config_value;
    });
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// PUT /api/storefront/config (admin)
router.put(
  '/config',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entries = Object.entries(req.body) as [string, string][];
      await withTransaction(async (client) => {
        for (const [key, value] of entries) {
          await client.query(
            `INSERT INTO storefront_config (config_key, config_value, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT(config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
            [key, String(value)]
          );
        }
      });
      res.json({ success: true, data: req.body });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/storefront/banners
router.get('/banners', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      'SELECT * FROM storefront_banners WHERE is_active = 1 ORDER BY position'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
