import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { reservationsController } from './controller';

const router: Router = Router();

// POST /api/reservations (Admin)
// Admin-only until Storefront ships; lift only with a named abuse control (rate limit or hold cap), never back to anonymous stock holds.
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  reservationsController.createReservation(req, res, next)
);

// DELETE /api/reservations/source/:sourceId - Release all reservations for a source (Admin)
// Admin-only until Storefront ships; lift only with a named abuse control (rate limit or hold cap), never back to anonymous stock holds.
router.delete('/source/:sourceId', verifyToken, requireRole('Admin'), (req, res, next) =>
  reservationsController.deleteBySourceId(req, res, next)
);

// DELETE /api/reservations/:id (Admin)
// Admin-only until Storefront ships; lift only with a named abuse control (rate limit or hold cap), never back to anonymous stock holds.
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  reservationsController.deleteReservation(req, res, next)
);

export default router;
