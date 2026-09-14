import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { uploadRateLimit } from '../../../../middleware/upload';
import { createImageUpload, validateImageBytes } from '../../../storage/upload';
import { collectionsController } from './controller';

// Same intake as the product image route: memory-backed, 2 MB, magic bytes checked.
const upload = createImageUpload({ maxSize: 2 * 1024 * 1024 });
const router: Router = Router();

// GET /api/collections
router.get('/', verifyToken, (req, res, next) =>
  collectionsController.getCollections(req, res, next)
);

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

// POST /api/collections/:id/image
router.post(
  '/:id/image',
  verifyToken,
  requireRole('Admin'),
  uploadRateLimit,
  upload.single('image'),
  validateImageBytes,
  (req, res, next) => collectionsController.uploadImage(req, res, next)
);

// DELETE /api/collections/:id/image
router.delete('/:id/image', verifyToken, requireRole('Admin'), (req, res, next) =>
  collectionsController.deleteImage(req, res, next)
);

export default router;
