import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { feedbackController } from './controller';

const router: Router = Router();

// POST /api/feedback — Submit customer feedback (public or POS)
router.post('/', (req, res, next) => feedbackController.submitFeedback(req, res, next));

// GET /api/feedback — List feedback (Admin)
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  feedbackController.getFeedback(req, res, next)
);

export default router;
