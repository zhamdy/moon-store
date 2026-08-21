import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { collectionsController } from './controller';

const router: Router = Router();

// GET /api/collections
router.get('/', verifyToken, (req, res, next) => collectionsController.getCollections(req, res, next));

// GET /api/collections/:id
router.get('/:id', verifyToken, (req, res, next) =>
  collectionsController.getCollectionById(req, res, next)
);

// POST /api/collections
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  collectionsController.createCollection(req, res, next)
);

// PUT /api/collections/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  collectionsController.updateCollection(req, res, next)
);

// DELETE /api/collections/:id
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  collectionsController.deleteCollection(req, res, next)
);

export default router;
