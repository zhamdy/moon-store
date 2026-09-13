import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { cacheControl } from '../../../../middleware/cache';
import { usersController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  usersController.getUsers(req, res, next)
);
router.get('/delivery', verifyToken, requireRole('Admin'), cacheControl(60), (req, res, next) =>
  usersController.getDeliveryUsers(req, res, next)
);
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  usersController.createUser(req, res, next)
);
router.get('/me/favorites', verifyToken, (req, res, next) =>
  usersController.getFavorites(req, res, next)
);
router.put('/me/favorites', verifyToken, (req, res, next) =>
  usersController.updateFavorites(req, res, next)
);
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  usersController.updateUser(req, res, next)
);
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  usersController.deleteUser(req, res, next)
);

export default router;
