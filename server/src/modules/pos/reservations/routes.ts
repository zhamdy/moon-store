import { Router } from 'express';
import { verifyToken } from '../../../../middleware/auth';
import { reservationsController } from './controller';

const router: Router = Router();

// POST /api/reservations
router.post('/', verifyToken, (req, res, next) =>
  reservationsController.createReservation(req, res, next)
);

// DELETE /api/reservations/:id
router.delete('/:id', verifyToken, (req, res, next) =>
  reservationsController.deleteReservation(req, res, next)
);

// DELETE /api/reservations/source/:sourceId - Release all reservations for a source
router.delete('/source/:sourceId', verifyToken, (req, res, next) =>
  reservationsController.deleteBySourceId(req, res, next)
);

export default router;
