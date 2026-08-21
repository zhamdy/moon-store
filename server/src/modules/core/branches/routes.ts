import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { branchesController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  branchesController.getBranches(req, res, next)
);
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  branchesController.createBranch(req, res, next)
);
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  branchesController.updateBranch(req, res, next)
);
router.get('/consolidated', verifyToken, requireRole('Admin'), (req, res, next) =>
  branchesController.getConsolidated(req, res, next)
);
router.get('/transfers', verifyToken, requireRole('Admin'), (req, res, next) =>
  branchesController.getTransfers(req, res, next)
);
router.post('/transfers', verifyToken, requireRole('Admin'), (req, res, next) =>
  branchesController.createTransfer(req, res, next)
);
router.put('/transfers/:id/status', verifyToken, requireRole('Admin'), (req, res, next) =>
  branchesController.updateTransferStatus(req, res, next)
);

export default router;
