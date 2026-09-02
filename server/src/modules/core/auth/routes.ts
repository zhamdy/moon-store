import { Router } from 'express';
import { verifyToken } from '../../../../middleware/auth';
import { createAuthLimiter } from '../../../http/rateLimits';
import { authController } from './controller';

const router: Router = Router();

const authLimiter = createAuthLimiter();

router.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/refresh', authLimiter, (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', verifyToken, (req, res, next) => authController.logout(req, res, next));
router.post('/logout-all', verifyToken, (req, res, next) =>
  authController.logoutAll(req, res, next)
);
router.get('/me', verifyToken, (req, res, next) => authController.getMe(req, res, next));

export default router;
