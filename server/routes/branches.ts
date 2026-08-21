import { Router, Request, Response, NextFunction } from 'express';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router: Router = Router();

const branchSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  type: z.enum(['Store', 'Warehouse']).default('Store'),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  manager_id: z.number().int().positive().optional().nullable(),
  opening_hours: z.string().optional().nullable(),
  currency: z.string().default('SAR'),
  tax_rate: z.number().min(0).max(100).default(15),
});

const transferSchema = z.object({
  from_location_id: z.number().int().positive(),
  to_location_id: z.number().int().positive(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  notes: z.string().optional().nullable(),
});

const storeSettingSchema = z.object({
  setting_key: z.string().min(1),
  setting_value: z.string(),
});

// GET /api/branches/transfers — direct stock transfer history (MUST be before /:id)
router.get(
  '/transfers',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT t.*, fl.name as from_location_name, tl.name as to_location_name, u.name as user_name
       FROM stock_transfers t
       LEFT JOIN locations fl ON t.from_location_id = fl.id
       LEFT JOIN locations tl ON t.to_location_id = tl.id
       LEFT JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at DESC LIMIT 100`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/branches/transfers — create direct stock transfer (MUST be before /:id)
router.post(
  '/transfers',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = transferSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { from_location_id, to_location_id, items, notes } = parsed.data;
      if (from_location_id === to_location_id) {
        return res
          .status(400)
          .json({ success: false, error: 'Cannot transfer to the same location' });
      }

      try {
        const transfer = await withTransaction(async (client) => {
          const transferRes = await client.query(
            `INSERT INTO stock_transfers (from_location_id, to_location_id, status, notes, user_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [from_location_id, to_location_id, 'completed', notes || null, authReq.user!.id]
          );
          const transferRow = transferRes.rows[0];

          for (const item of items) {
            await client.query(
              'INSERT INTO stock_transfer_items (transfer_id, product_id, quantity) VALUES ($1, $2, $3)',
              [transferRow.id, item.product_id, item.quantity]
            );

            // Deduct from source
            const fromStockRes = await client.query<{ stock: number }>(
              'SELECT stock FROM product_locations WHERE product_id = $1 AND location_id = $2',
              [item.product_id, from_location_id]
            );
            const fromStock = fromStockRes.rows[0];

            if (!fromStock || fromStock.stock < item.quantity) {
              throw new Error(`Insufficient stock at source for product ${item.product_id}`);
            }

            await client.query(
              'UPDATE product_locations SET stock = stock - $1 WHERE product_id = $2 AND location_id = $3',
              [item.quantity, item.product_id, from_location_id]
            );

            // Add to destination (upsert)
            await client.query(
              `INSERT INTO product_locations (product_id, location_id, stock) VALUES ($1, $2, $3)
               ON CONFLICT(product_id, location_id) DO UPDATE SET stock = product_locations.stock + EXCLUDED.stock`,
              [item.product_id, to_location_id, item.quantity]
            );
          }

          await client.query('UPDATE stock_transfers SET completed_at = NOW() WHERE id = $1', [
            transferRow.id,
          ]);
          return transferRow;
        });

        res.status(201).json({ success: true, data: transfer });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ success: false, error: message });
      }
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/branches/dashboard/consolidated — multi-store dashboard (MUST be before /:id)
router.get(
  '/dashboard/consolidated',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const storeStats = await db.query(
        `SELECT l.id, l.name,
        (SELECT COUNT(*)::int FROM sales s WHERE s.location_id = l.id AND s.created_at::date = CURRENT_DATE) as today_sales,
        (SELECT COALESCE(SUM(s.total), 0) FROM sales s WHERE s.location_id = l.id AND s.created_at::date = CURRENT_DATE) as today_revenue,
        (SELECT COALESCE(SUM(pl.stock), 0) FROM product_locations pl WHERE pl.location_id = l.id) as total_stock,
        (SELECT COUNT(*)::int FROM product_locations pl WHERE pl.location_id = l.id AND pl.stock <= 5) as low_stock_count
       FROM locations l WHERE l.status = 'active' ORDER BY l.name`
      );
      const totals = await db.query(
        `SELECT
        (SELECT COUNT(*)::int FROM sales WHERE created_at::date = CURRENT_DATE) as total_today_sales,
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE created_at::date = CURRENT_DATE) as total_today_revenue,
        (SELECT COUNT(*)::int FROM locations WHERE status = 'active') as store_count`
      );
      res.json({ success: true, data: { stores: storeStats.rows, totals: totals.rows[0] } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/branches/transfers/requests — transfer requests (MUST be before /:id)
router.get(
  '/transfers/requests',
  verifyToken,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT tr.*, fl.name as from_location_name, tl.name as to_location_name,
        ru.name as requested_by_name, au.name as approved_by_name
       FROM transfer_requests tr
       LEFT JOIN locations fl ON tr.from_location_id = fl.id
       LEFT JOIN locations tl ON tr.to_location_id = tl.id
       LEFT JOIN users ru ON tr.requested_by = ru.id
       LEFT JOIN users au ON tr.approved_by = au.id
       ORDER BY tr.created_at DESC LIMIT 100`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/branches/transfers/requests (MUST be before /:id)
router.post(
  '/transfers/requests',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { from_location_id, to_location_id, items, notes } = req.body;
      const result = await withTransaction(async (client) => {
        const reqRes = await client.query(
          'INSERT INTO transfer_requests (from_location_id, to_location_id, requested_by, notes) VALUES ($1, $2, $3, $4) RETURNING *',
          [from_location_id, to_location_id, authReq.user!.id, notes || null]
        );
        const request = reqRes.rows[0];
        for (const item of items) {
          await client.query(
            'INSERT INTO transfer_request_items (request_id, product_id, quantity) VALUES ($1, $2, $3)',
            [request.id, item.product_id, item.quantity]
          );
        }
        return request;
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/branches — all branches with manager info
router.get('/', verifyToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT l.*, u.name as manager_name,
        (SELECT COUNT(*)::int FROM product_locations pl WHERE pl.location_id = l.id) as product_count,
        (SELECT COALESCE(SUM(pl.stock), 0) FROM product_locations pl WHERE pl.location_id = l.id) as total_stock
       FROM locations l
       LEFT JOIN users u ON l.manager_id = u.id
       WHERE l.status = 'active'
       ORDER BY l.is_primary DESC, l.name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/branches/:id — single branch with settings
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branch = await db.query(
      `SELECT l.*, u.name as manager_name
       FROM locations l LEFT JOIN users u ON l.manager_id = u.id
       WHERE l.id = $1`,
      [req.params.id]
    );
    if (branch.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }
    const settings = await db.query(
      'SELECT setting_key, setting_value FROM store_settings WHERE location_id = $1',
      [req.params.id]
    );
    res.json({ success: true, data: { ...branch.rows[0], settings: settings.rows } });
  } catch (err) {
    next(err);
  }
});

// POST /api/branches
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = branchSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      const { name, address, type, phone, email, manager_id, opening_hours, currency, tax_rate } =
        parsed.data;
      const result = await db.query(
        `INSERT INTO locations (name, address, type, phone, email, manager_id, opening_hours, currency, tax_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          name,
          address || null,
          type,
          phone || null,
          email || null,
          manager_id || null,
          opening_hours || null,
          currency,
          tax_rate,
        ]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/branches/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = branchSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      const { name, address, type, phone, email, manager_id, opening_hours, currency, tax_rate } =
        parsed.data;
      const result = await db.query(
        `UPDATE locations SET name=$1, address=$2, type=$3, phone=$4, email=$5, manager_id=$6, opening_hours=$7, currency=$8, tax_rate=$9
       WHERE id = $10 RETURNING *`,
        [
          name,
          address || null,
          type,
          phone || null,
          email || null,
          manager_id || null,
          opening_hours || null,
          currency,
          tax_rate,
          req.params.id,
        ]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ success: false, error: 'Branch not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/branches/:id (soft delete)
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const check = await db.query('SELECT is_primary FROM locations WHERE id = $1', [
        req.params.id,
      ]);
      if (check.rows.length === 0)
        return res.status(404).json({ success: false, error: 'Branch not found' });
      if ((check.rows[0] as { is_primary: number }).is_primary)
        return res.status(400).json({ success: false, error: 'Cannot delete primary branch' });
      await db.query("UPDATE locations SET status = 'inactive' WHERE id = $1", [req.params.id]);
      res.json({ success: true, data: { message: 'Branch deactivated' } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/branches/:id/settings
router.get(
  '/:id/settings',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query('SELECT * FROM store_settings WHERE location_id = $1', [
        req.params.id,
      ]);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/branches/:id/settings
router.put(
  '/:id/settings',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = storeSettingSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      const { setting_key, setting_value } = parsed.data;
      await db.query(
        `INSERT INTO store_settings (location_id, setting_key, setting_value)
       VALUES ($1, $2, $3) ON CONFLICT(location_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
        [req.params.id, setting_key, setting_value]
      );
      res.json({ success: true, data: { setting_key, setting_value } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
