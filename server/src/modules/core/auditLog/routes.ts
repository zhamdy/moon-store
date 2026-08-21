import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { auditLogController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  auditLogController.getAuditLogs(req, res, next)
);
router.get('/actions', verifyToken, requireRole('Admin'), (req, res, next) =>
  auditLogController.getActions(req, res, next)
);

export default router;
