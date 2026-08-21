import { Router, Request, Response, NextFunction } from 'express';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';

const router: Router = Router();

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// GET /api/exports/products — Export products as CSV
router.get(
  '/products',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT p.id, p.name, p.sku, p.barcode, p.price, p.cost_price, p.stock, p.min_stock,
                c.name as category, d.name as distributor, p.status, p.created_at
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN distributors d ON p.distributor_id = d.id
         ORDER BY p.name ASC`
      );

      const headers = [
        'id',
        'name',
        'sku',
        'barcode',
        'price',
        'cost_price',
        'stock',
        'min_stock',
        'category',
        'distributor',
        'status',
        'created_at',
      ];
      const csv = toCsv(headers, result.rows);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=products-${new Date().toISOString().split('T')[0]}.csv`
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/exports/sales — Export sales transactions as CSV
router.get(
  '/sales',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const where: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (from) {
        where.push(`s.created_at >= $${paramIdx++}`);
        params.push(from);
      }
      if (to) {
        where.push(`s.created_at <= $${paramIdx++}`);
        params.push(to);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const result = await db.query(
        `SELECT s.receipt_number, s.created_at, u.name as cashier, c.name as customer, c.phone as customer_phone,
                s.subtotal, s.discount, s.tax, s.total, s.payment_method, s.status, s.notes
         FROM sales s
         LEFT JOIN users u ON s.cashier_id = u.id
         LEFT JOIN customers c ON s.customer_id = c.id
         ${whereClause}
         ORDER BY s.created_at DESC`,
        params
      );

      const headers = [
        'receipt_number',
        'created_at',
        'cashier',
        'customer',
        'customer_phone',
        'subtotal',
        'discount',
        'tax',
        'total',
        'payment_method',
        'status',
        'notes',
      ];
      const csv = toCsv(headers, result.rows);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=sales-${new Date().toISOString().split('T')[0]}.csv`
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/exports/customers — Export customer list as CSV
router.get(
  '/customers',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT c.id, c.name, c.phone, c.address, c.notes, c.loyalty_points, c.created_at,
                COALESCE(SUM(s.total), 0) as total_spent,
                COUNT(s.id)::int as total_orders
         FROM customers c
         LEFT JOIN sales s ON s.customer_id = c.id
         GROUP BY c.id, c.name, c.phone, c.address, c.notes, c.loyalty_points, c.created_at
         ORDER BY c.name ASC`
      );

      const headers = [
        'id',
        'name',
        'phone',
        'address',
        'notes',
        'loyalty_points',
        'total_spent',
        'total_orders',
        'created_at',
      ];
      const csv = toCsv(headers, result.rows);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=customers-${new Date().toISOString().split('T')[0]}.csv`
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
