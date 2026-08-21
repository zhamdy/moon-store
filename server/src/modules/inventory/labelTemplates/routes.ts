import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { labelTemplatesController } from './controller';

const router: Router = Router();

// GET /api/label-templates
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  labelTemplatesController.getLabelTemplates(req, res, next)
);

// POST /api/label-templates
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  labelTemplatesController.createLabelTemplate(req, res, next)
);

// PUT /api/label-templates/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  labelTemplatesController.updateLabelTemplate(req, res, next)
);

// DELETE /api/label-templates/:id
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  labelTemplatesController.deleteLabelTemplate(req, res, next)
);

export default router;
