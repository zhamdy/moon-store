import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

// GET /api/segments — Customer RFM segmentation
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Get RFM data for each customer
      const result = await db.query(
        `SELECT
          c.id, c.name, c.phone,
          CAST(julianday('now') - julianday(MAX(s.created_at)) AS INTEGER) as recency_days,
          COUNT(DISTINCT s.id) as frequency,
          COALESCE(SUM(s.total), 0) as monetary,
          c.loyalty_points
         FROM customers c
         LEFT JOIN sales s ON s.customer_id = c.id
         GROUP BY c.id
         ORDER BY monetary DESC`
      );

      // Calculate RFM scores and assign segments
      const customers = result.rows.map((c: any) => {
        const recency = c.recency_days === null ? 999 : c.recency_days;
        const frequency = c.frequency || 0;
        const monetary = c.monetary || 0;

        // Simple scoring: R (lower = better), F & M (higher = better)
        const rScore =
          recency <= 7 ? 5 : recency <= 30 ? 4 : recency <= 60 ? 3 : recency <= 90 ? 2 : 1;
        const fScore =
          frequency >= 20 ? 5 : frequency >= 10 ? 4 : frequency >= 5 ? 3 : frequency >= 2 ? 2 : 1;
        const mScore =
          monetary >= 5000
            ? 5
            : monetary >= 2000
              ? 4
              : monetary >= 1000
                ? 3
                : monetary >= 500
                  ? 2
                  : 1;

        let segment = 'lost';
        if (rScore >= 4 && fScore >= 4 && mScore >= 4) segment = 'champions';
        else if (rScore >= 3 && fScore >= 3) segment = 'loyal';
        else if (rScore >= 3 && fScore <= 2) segment = 'potential';
        else if (rScore <= 2 && fScore >= 3) segment = 'at_risk';
        else if (rScore <= 2 && fScore <= 2 && monetary > 0) segment = 'hibernating';
        else if (frequency === 0) segment = 'new';

        return {
          ...c,
          recency_days: recency,
          r_score: rScore,
          f_score: fScore,
          m_score: mScore,
          segment,
        };
      });

      // Aggregate by segment
      const segments = ['champions', 'loyal', 'potential', 'at_risk', 'hibernating', 'lost', 'new'];
      const summary = segments.map((seg) => {
        const segCustomers = customers.filter((c: any) => c.segment === seg);
        return {
          segment: seg,
          count: segCustomers.length,
          total_revenue: segCustomers.reduce((sum: number, c: any) => sum + (c.monetary || 0), 0),
          avg_frequency:
            segCustomers.length > 0
              ? segCustomers.reduce((sum: number, c: any) => sum + (c.frequency || 0), 0) /
                segCustomers.length
              : 0,
        };
      });

      res.json({ success: true, data: { customers, summary } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
