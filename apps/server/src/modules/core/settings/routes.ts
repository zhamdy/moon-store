import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { settingsController } from './controller';

const router: Router = Router();

// Admin + Cashier: POS checkout reads tax/loyalty settings as Cashier; Delivery has no use (#162).
router.get('/', verifyToken, requireRole('Admin', 'Cashier'), (req, res, next) =>
  settingsController.getSettings(req, res, next)
);
router.put('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  settingsController.updateSettings(req, res, next)
);

export default router;
