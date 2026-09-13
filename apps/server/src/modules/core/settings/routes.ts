import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { settingsController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, (req, res, next) => settingsController.getSettings(req, res, next));
router.put('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  settingsController.updateSettings(req, res, next)
);

export default router;
