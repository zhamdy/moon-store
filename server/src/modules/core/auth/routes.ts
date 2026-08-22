import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../../../middleware/auth';
import { errorResponse } from '../../../http/errors';
import { authController } from './controller';

const router: Router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('RATE_LIMITED', 'Too many login attempts, please try again later'),
});

router.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/refresh', authLimiter, (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', verifyToken, (req, res, next) => authController.logout(req, res, next));
router.get('/me', verifyToken, (req, res, next) => authController.getMe(req, res, next));

export default router;
