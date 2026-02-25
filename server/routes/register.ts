import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';
import {
  getCurrentSession,
  openSession,
  addMovement,
  closeSession,
  getSessionReport,
  getSessionHistory,
  forceCloseSession,
} from '../services/registerService';

const router: Router = Router();

// --- Zod schemas ---

const openRegisterSchema = z.object({
  opening_float: z.number().min(0, 'Opening float must be non-negative'),
});

const movementSchema = z.object({
  type: z.enum(['cash_in', 'cash_out']),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().max(500).optional(),
});

const closeRegisterSchema = z.object({
  counted_cash: z.number().min(0, 'Counted cash must be non-negative'),
  notes: z.string().max(500).optional(),
});

// GET /api/register/current — Get current open session for logged-in user
router.get(
  '/current',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;

      const session = await getCurrentSession(userId);

      res.json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/register/open — Open a new register session
router.post(
  '/open',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = openRegisterSchema.parse(req.body);

      const result = await openSession(userId, parsed.opening_float);
      if (result.error) {
        return res.status(400).json({ success: false, error: result.error });
      }

      logAuditFromReq(req, 'register_open', 'register_session', result.session!.id as number, {
        opening_float: parsed.opening_float,
      });

      res.json({ success: true, data: result.session! });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// POST /api/register/movement — Record a cash in/out movement
router.post(
  '/movement',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = movementSchema.parse(req.body);

      const result = await addMovement(userId, parsed.type, parsed.amount, parsed.note);
      if (result.error) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json({ success: true, data: result.movement });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// POST /api/register/close — Close the current register session
router.post(
  '/close',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = closeRegisterSchema.parse(req.body);

      const result = await closeSession(userId, parsed.counted_cash, parsed.notes);
      if (result.error) {
        return res.status(400).json({ success: false, error: result.error });
      }

      logAuditFromReq(req, 'register_close', 'register_session', result.session!.id as number, {
        expected_cash: result.session!.expected_cash,
        counted_cash: parsed.counted_cash,
        variance: result.session!.variance,
      });

      res.json({ success: true, data: result.session! });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// GET /api/register/:id/report — Get X or Z report for a session
router.get(
  '/:id/report',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const result = await getSessionReport(id);
      if (result.error) {
        return res.status(404).json({ success: false, error: result.error });
      }

      res.json({
        success: true,
        data: result.report,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/register/history — List past register sessions
router.get(
  '/history',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, cashier_id, from, to } = req.query as Record<string, string | undefined>;

      const result = await getSessionHistory({
        page: page || '1',
        limit: limit || '25',
        cashier_id,
        from,
        to,
      });

      res.json({
        success: true,
        data: result.rows,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/register/:id/force-close — Admin force-close an open session
router.post(
  '/:id/force-close',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const result = await forceCloseSession(id);
      if (result.error) {
        return res.status(404).json({ success: false, error: result.error });
      }

      logAuditFromReq(req, 'register_force_close', 'register_session', Number(id));

      res.json({ success: true, data: result.session });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

// Re-export cross-route helpers from service so existing consumers keep working
export { recordSaleMovement, recordRefundMovement } from '../services/registerService';
