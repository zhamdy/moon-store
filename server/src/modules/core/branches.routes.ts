import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { withTransaction } from '../../database/transaction';
import { verifyToken, requireRole, AuthRequest } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const branchSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  address: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  is_main: z.boolean().optional(),
});

const transferSchema = z.object({
  source_branch_id: z.number().int().positive(),
  target_branch_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive(),
  notes: z.string().max(255).optional(),
});

// GET /api/branches
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const branches = await db.query(
        `SELECT b.*,
         (SELECT COUNT(*)::int FROM branch_inventory WHERE branch_id = b.id) as product_count,
         (SELECT COALESCE(SUM(stock), 0)::int FROM branch_inventory WHERE branch_id = b.id) as total_stock
         FROM branches b ORDER BY b.is_main DESC, b.name ASC`
      );
      res.json({ success: true, data: branches.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/branches
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = branchSchema.parse(req.body);
      const isMain = parsed.is_main ? 1 : 0;

      if (isMain) {
        await db.query('UPDATE branches SET is_main = 0 WHERE is_main = 1');
      }

      const result = await db.query(
        `INSERT INTO branches (name, code, address, phone, is_main)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [parsed.name, parsed.code, parsed.address || null, parsed.phone || null, isMain]
      );

      logAuditFromReq(req, 'create', 'branch', result.rows[0].id as number, { name: parsed.name });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        return res.status(409).json({ success: false, error: 'Branch code already exists' });
      }
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
      const parsed = branchSchema.parse(req.body);
      const id = Number(req.params.id);
      const isMain = parsed.is_main ? 1 : 0;

      const existing = await db.query('SELECT * FROM branches WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Branch not found' });
      }

      if (isMain) {
        await db.query('UPDATE branches SET is_main = 0 WHERE id != $1 AND is_main = 1', [id]);
      }

      const result = await db.query(
        `UPDATE branches SET name = $1, code = $2, address = $3, phone = $4, is_main = $5, updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [parsed.name, parsed.code, parsed.address || null, parsed.phone || null, isMain, id]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// GET /api/branches/consolidated
router.get(
  '/consolidated',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const branches = await db.query('SELECT id, name, code, is_main FROM branches ORDER BY name');

      const data = await Promise.all(
        branches.rows.map(async (b: any) => {
          const stats = await db.query(
            `SELECT
              (SELECT COUNT(*)::int FROM branch_inventory WHERE branch_id = $1) as products,
              (SELECT COALESCE(SUM(stock), 0)::int FROM branch_inventory WHERE branch_id = $1) as stock`,
            [b.id]
          );
          return {
            ...b,
            stats: stats.rows[0],
          };
        })
      );

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/branches/transfers
router.get(
  '/transfers',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page = '1', limit = '20' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      const params: unknown[] = [];
      let where = '';

      if (status && status !== 'all') {
        params.push(status);
        where = `WHERE t.status = $${params.length}`;
      }

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const transfers = await db.query(
        `SELECT t.*, sb.name as source_branch, tb.name as target_branch,
                p.name as product_name, p.sku as product_sku,
                u.name as created_by_name
         FROM branch_transfers t
         JOIN branches sb ON t.source_branch_id = sb.id
         JOIN branches tb ON t.target_branch_id = tb.id
         JOIN products p ON t.product_id = p.id
         LEFT JOIN users u ON t.created_by = u.id
         ${where}
         ORDER BY t.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, Number(limit), offset]
      );

      res.json({ success: true, data: transfers.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/branches/transfers
router.post(
  '/transfers',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = transferSchema.parse(req.body);

      if (parsed.source_branch_id === parsed.target_branch_id) {
        return res
          .status(400)
          .json({ success: false, error: 'Source and target branch must be different' });
      }

      const result = await db.query(
        `INSERT INTO branch_transfers (source_branch_id, target_branch_id, product_id, variant_id, quantity, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          parsed.source_branch_id,
          parsed.target_branch_id,
          parsed.product_id,
          parsed.variant_id || null,
          parsed.quantity,
          parsed.notes || null,
          authReq.user!.id,
        ]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// PUT /api/branches/transfers/:id/status
router.put(
  '/transfers/:id/status',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;

      if (!['in_transit', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      const transfer = (await db.query('SELECT * FROM branch_transfers WHERE id = $1', [id]))
        .rows[0] as Record<string, any> | undefined;
      if (!transfer) {
        return res.status(404).json({ success: false, error: 'Transfer not found' });
      }

      if (status === 'completed' && transfer.status !== 'completed') {
        await withTransaction(async (client) => {
          // Decrement source branch inventory
          await client.query(
            `INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock)
             VALUES ($1, $2, $3, 0)
             ON CONFLICT(branch_id, product_id, COALESCE(variant_id, 0)) DO NOTHING`,
            [transfer.source_branch_id, transfer.product_id, transfer.variant_id]
          );
          await client.query(
            `UPDATE branch_inventory SET stock = GREATEST(0, stock - $1), updated_at = NOW()
             WHERE branch_id = $2 AND product_id = $3`,
            [transfer.quantity, transfer.source_branch_id, transfer.product_id]
          );

          // Increment target branch inventory
          await client.query(
            `INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT(branch_id, product_id, COALESCE(variant_id, 0))
             DO UPDATE SET stock = branch_inventory.stock + $4, updated_at = NOW()`,
            [transfer.target_branch_id, transfer.product_id, transfer.variant_id, transfer.quantity]
          );

          // Update transfer record
          await client.query(
            'UPDATE branch_transfers SET status = $1, completed_at = NOW() WHERE id = $2',
            [status, id]
          );
        });
      } else {
        await db.query('UPDATE branch_transfers SET status = $1 WHERE id = $2', [status, id]);
      }

      res.json({ success: true, data: { id, status } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
