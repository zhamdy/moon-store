import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { segmentsController } from './controller';

const router: Router = Router();

// GET /api/segments
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  segmentsController.getSegments(req, res, next)
);

// POST /api/segments
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  segmentsController.createSegment(req, res, next)
);

// PUT /api/segments/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  segmentsController.updateSegment(req, res, next)
);

// DELETE /api/segments/:id
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  segmentsController.deleteSegment(req, res, next)
);

export default router;
