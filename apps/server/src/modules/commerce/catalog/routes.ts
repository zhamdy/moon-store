/**
 * The public catalog: four anonymous GETs, nothing that writes (KD-1).
 *
 * Deliberately no `verifyToken` anywhere in this router; the manifest classifies every
 * route `publicAuth` and `check:route-auth` holds the two in agreement.
 *
 * Order matters: the catalog limiter answers a 429 before anything else runs, and sets
 * `no-store` on it itself; the status-aware cache header then covers every response the
 * router or the app's 404 fallback produces (2xx public, everything else no-store).
 */
import { Router } from 'express';
import { createCatalogLimiter } from '../../../http/rateLimits';
import { publicCacheOnSuccess } from '../../../../middleware/cache';
import { CATALOG_CACHE_SECONDS } from './constants';
import { catalogController } from './controller';

const router: Router = Router();

router.use(createCatalogLimiter());
router.use(publicCacheOnSuccess(CATALOG_CACHE_SECONDS));

// GET /api/v1/catalog/products (Public)
router.get('/products', (req, res, next) => catalogController.listProducts(req, res, next));

// GET /api/v1/catalog/categories (Public)
router.get('/categories', (req, res, next) => catalogController.listCategories(req, res, next));

// GET /api/v1/catalog/collections (Public)
router.get('/collections', (req, res, next) => catalogController.listCollections(req, res, next));

// GET /api/v1/catalog/collections/:slug (Public)
router.get('/collections/:slug', (req, res, next) =>
  catalogController.getCollection(req, res, next)
);

export default router;
