import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router: Router = Router();

const vendorSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  commission_rate: z.number().min(0).max(100).default(15),
  bank_name: z.string().optional().nullable(),
  bank_account: z.string().optional().nullable(),
  bank_iban: z.string().optional().nullable(),
});

// GET /api/vendors/dashboard/stats — vendor summary for admin (MUST be before /:id)
router.get(
  '/dashboard/stats',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await db.query(
        `SELECT
        (SELECT COUNT(*) FROM vendors WHERE status = 'active') as active_vendors,
        (SELECT COUNT(*) FROM vendors WHERE status = 'pending') as pending_vendors,
        (SELECT COALESCE(SUM(balance), 0) FROM vendors) as total_unpaid,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM vendor_commissions WHERE status = 'pending') as pending_commissions`
      );
      res.json({ success: true, data: stats.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/vendors
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (status) {
      where += ' AND v.status = ?';
      params.push(status);
    }
    const result = await db.query(
      `SELECT v.*, (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id) as product_count FROM vendors v ${where} ORDER BY v.created_at DESC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/vendors/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendor = await db.query('SELECT * FROM vendors WHERE id = ?', [req.params.id]);
    if (vendor.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    const products = await db.query(
      'SELECT * FROM products WHERE vendor_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    const commissions = await db.query(
      'SELECT * FROM vendor_commissions WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );
    res.json({
      success: true,
      data: { ...vendor.rows[0], products: products.rows, commissions: commissions.rows },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/vendors
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = vendorSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      const d = parsed.data;
      const result = await db.query(
        `INSERT INTO vendors (name, slug, email, phone, description, address, city, commission_rate, bank_name, bank_account, bank_iban, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active') RETURNING *`,
        [
          d.name,
          d.slug,
          d.email,
          d.phone,
          d.description,
          d.address,
          d.city,
          d.commission_rate,
          d.bank_name,
          d.bank_account,
          d.bank_iban,
        ]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/vendors/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = vendorSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      const d = parsed.data;
      const result = await db.query(
        `UPDATE vendors SET name=?, slug=?, email=?, phone=?, description=?, address=?, city=?, commission_rate=?, bank_name=?, bank_account=?, bank_iban=?
       WHERE id=? RETURNING *`,
        [
          d.name,
          d.slug,
          d.email,
          d.phone,
          d.description,
          d.address,
          d.city,
          d.commission_rate,
          d.bank_name,
          d.bank_account,
          d.bank_iban,
          req.params.id,
        ]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ success: false, error: 'Vendor not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/vendors/:id/status
router.put(
  '/:id/status',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      const validStatuses = ['pending', 'active', 'suspended', 'rejected'];
      if (!validStatuses.includes(status))
        return res.status(400).json({ success: false, error: 'Invalid status' });
      let extra = '';
      if (status === 'active') extra = ", approved_at = datetime('now')";
      const result = await db.query(
        `UPDATE vendors SET status = ?${extra} WHERE id = ? RETURNING *`,
        [status, req.params.id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ success: false, error: 'Vendor not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/vendors/:id/payouts
router.get('/:id/payouts', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      'SELECT * FROM vendor_payouts WHERE vendor_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/vendors/:id/payouts
router.post(
  '/:id/payouts',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { amount, method, reference, notes } = req.body;
      const result = await db.query(
        `INSERT INTO vendor_payouts (vendor_id, amount, method, reference, notes, processed_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
        [
          req.params.id,
          amount,
          method || 'bank_transfer',
          reference || null,
          notes || null,
          authReq.user!.id,
        ]
      );
      // Deduct from vendor balance
      await db.query('UPDATE vendors SET balance = balance - ? WHERE id = ?', [
        amount,
        req.params.id,
      ]);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
