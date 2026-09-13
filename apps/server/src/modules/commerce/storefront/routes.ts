import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { cacheControl } from '../../../../middleware/cache';
import { storefrontController } from './controller';

const router: Router = Router();

// GET /api/storefront/banners (Public)
router.get('/banners', cacheControl(60), (req, res, next) =>
  storefrontController.getActiveBanners(req, res, next)
);

// GET /api/storefront/banners/all (Admin)
router.get('/banners/all', verifyToken, requireRole('Admin'), (req, res, next) =>
  storefrontController.getAllBanners(req, res, next)
);

// POST /api/storefront/banners (Admin)
router.post('/banners', verifyToken, requireRole('Admin'), (req, res, next) =>
  storefrontController.createBanner(req, res, next)
);

// PUT /api/storefront/banners/:id (Admin)
router.put('/banners/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  storefrontController.updateBanner(req, res, next)
);

// DELETE /api/storefront/banners/:id (Admin)
router.delete('/banners/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  storefrontController.deleteBanner(req, res, next)
);

export default router;
