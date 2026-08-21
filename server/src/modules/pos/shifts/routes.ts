import { Router } from 'express';
import { verifyToken } from '../../../../middleware/auth';
import { shiftsController } from './controller';

const router: Router = Router();

// GET /api/shifts/current
router.get('/current', verifyToken, (req, res, next) =>
  shiftsController.getCurrentShift(req, res, next)
);

// POST /api/shifts/clock-in
router.post('/clock-in', verifyToken, (req, res, next) =>
  shiftsController.clockIn(req, res, next)
);

// POST /api/shifts/clock-out
router.post('/clock-out', verifyToken, (req, res, next) =>
  shiftsController.clockOut(req, res, next)
);

// POST /api/shifts/break/start
router.post('/break/start', verifyToken, (req, res, next) =>
  shiftsController.startBreak(req, res, next)
);

// POST /api/shifts/break/end
router.post('/break/end', verifyToken, (req, res, next) =>
  shiftsController.endBreak(req, res, next)
);

// GET /api/shifts — List shifts (Admin or user's own)
router.get('/', verifyToken, (req, res, next) =>
  shiftsController.getShifts(req, res, next)
);

export default router;
