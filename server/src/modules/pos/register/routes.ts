import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { registerController } from './controller';

const router: Router = Router();

// GET /api/register/current — Get current open session for logged-in user
router.get(
  '/current',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  (req, res, next) => registerController.getCurrentSession(req, res, next)
);

// POST /api/register/open — Open a new register session
router.post(
  '/open',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  (req, res, next) => registerController.openSession(req, res, next)
);

// POST /api/register/movement — Record a cash in/out movement
router.post(
  '/movement',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  (req, res, next) => registerController.addMovement(req, res, next)
);

// POST /api/register/close — Close the current register session
router.post(
  '/close',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  (req, res, next) => registerController.closeSession(req, res, next)
);

// GET /api/register/history — List past register sessions
router.get(
  '/history',
  verifyToken,
  requireRole('Admin'),
  (req, res, next) => registerController.getSessionHistory(req, res, next)
);

// GET /api/register/:id/report — Get X or Z report for a session
router.get(
  '/:id/report',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  (req, res, next) => registerController.getSessionReport(req, res, next)
);

// POST /api/register/:id/force-close — Admin force-close an open session
router.post(
  '/:id/force-close',
  verifyToken,
  requireRole('Admin'),
  (req, res, next) => registerController.forceCloseSession(req, res, next)
);

export default router;
